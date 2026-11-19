using System.Buffers.Binary;
using System.ComponentModel;
using System.Diagnostics;
using System.Text.Json;
using System.Text.RegularExpressions;

const int maxRequestBytes = 1024;
var profileIdPattern = new Regex(@"\A(?:Default|Profile [1-9][0-9]{0,8})\z", RegexOptions.CultureInvariant);
var jsonOptions = new JsonSerializerOptions(JsonSerializerDefaults.Web);

using var input = Console.OpenStandardInput();
using var output = Console.OpenStandardOutput();
object reply;
try
{
    var header = new byte[sizeof(int)];
    input.ReadExactly(header);
    var length = BinaryPrimitives.ReadInt32LittleEndian(header);
    if (length is < 1 or > maxRequestBytes)
    {
        reply = Failure("invalid_request");
    }
    else
    {
        var request = new byte[length];
        input.ReadExactly(request);
        using var message = JsonDocument.Parse(request);
        reply = HandleRequest(message.RootElement);
    }
}
catch (Exception error) when (error is JsonException or IOException)
{
    reply = Failure("invalid_request");
}

var response = JsonSerializer.SerializeToUtf8Bytes(reply, jsonOptions);
if (response.Length > 1_048_576)
{
    response = JsonSerializer.SerializeToUtf8Bytes(Failure("profiles_unreadable"), jsonOptions);
}
var responseHeader = new byte[sizeof(int)];
BinaryPrimitives.WriteInt32LittleEndian(responseHeader, response.Length);
output.Write(responseHeader);
output.Write(response);
output.Flush();

object HandleRequest(JsonElement request)
{
    if (request.ValueKind != JsonValueKind.Object ||
        !request.TryGetProperty("command", out var command) ||
        command.ValueKind != JsonValueKind.String)
    {
        return Failure("invalid_request");
    }

    var count = request.EnumerateObject().Count();
    var operation = command.GetString();
    if (operation == "listProfiles" && count == 1)
    {
        return ReadProfiles(out var available)
            ? new { ok = true, profiles = available }
            : Failure("profiles_unreadable");
    }
    if (operation != "openProfile" || count != 2 ||
        !request.TryGetProperty("id", out var idProperty) ||
        idProperty.ValueKind != JsonValueKind.String ||
        idProperty.GetString() is not { } id ||
        !profileIdPattern.IsMatch(id))
    {
        return Failure("invalid_request");
    }
    if (!ReadProfiles(out var profiles))
    {
        return Failure("profiles_unreadable");
    }
    return profiles.Any(profile => profile.Id == id)
        ? OpenChrome(id)
        : Failure("profile_unavailable");
}

bool ReadProfiles(out ChromeProfile[] profiles)
{
    profiles = [];
    var userData = Path.Combine(
        Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
        "Google", "Chrome", "User Data");
    try
    {
        using var stream = new FileStream(
            Path.Combine(userData, "Local State"), FileMode.Open, FileAccess.Read,
            FileShare.ReadWrite | FileShare.Delete);
        using var state = JsonDocument.Parse(stream);
        if (state.RootElement.ValueKind != JsonValueKind.Object ||
            !state.RootElement.TryGetProperty("profile", out var profileState) ||
            profileState.ValueKind != JsonValueKind.Object ||
            !profileState.TryGetProperty("info_cache", out var cache) ||
            cache.ValueKind != JsonValueKind.Object)
        {
            return false;
        }

        var available = new List<ChromeProfile>();
        foreach (var entry in cache.EnumerateObject())
        {
            if (!profileIdPattern.IsMatch(entry.Name) ||
                entry.Value.ValueKind != JsonValueKind.Object ||
                !Directory.Exists(Path.Combine(userData, entry.Name)))
            {
                continue;
            }
            if (entry.Value.TryGetProperty("is_omitted", out var omitted) &&
                omitted.ValueKind == JsonValueKind.True)
            {
                continue;
            }
            var name = entry.Value.TryGetProperty("name", out var label) &&
                label.ValueKind == JsonValueKind.String ? label.GetString()?.Trim() : null;
            available.Add(new ChromeProfile(entry.Name, string.IsNullOrEmpty(name) ? entry.Name : name));
        }
        profiles = available.OrderBy(profile => profile.Name, StringComparer.CurrentCultureIgnoreCase)
            .ThenBy(profile => profile.Id, StringComparer.Ordinal).ToArray();
        return true;
    }
    catch (Exception error) when (error is JsonException or IOException or UnauthorizedAccessException)
    {
        return false;
    }
}

static object OpenChrome(string profileId)
{
    string[] roots =
    [
        Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles),
        Environment.GetFolderPath(Environment.SpecialFolder.ProgramFilesX86),
        Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData)
    ];
    var chrome = roots.Where(root => !string.IsNullOrEmpty(root))
        .Select(root => Path.Combine(root, "Google", "Chrome", "Application", "chrome.exe"))
        .FirstOrDefault(File.Exists);
    if (chrome is null)
    {
        return Failure("chrome_unavailable");
    }

    var start = new ProcessStartInfo(chrome) { UseShellExecute = true };
    start.ArgumentList.Add($"--profile-directory={profileId}");
    start.ArgumentList.Add("https://www.tiktok.com/");
    try
    {
        using var process = Process.Start(start);
        return new { ok = true };
    }
    catch (Exception error) when (error is Win32Exception or InvalidOperationException)
    {
        return Failure("chrome_unavailable");
    }
}

static object Failure(string error) => new { ok = false, error };

record ChromeProfile(string Id, string Name);
