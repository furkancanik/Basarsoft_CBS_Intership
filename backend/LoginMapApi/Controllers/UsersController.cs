using LoginMapApi.Data;
using LoginMapApi.Models;
using LoginMapApi.Security;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;
using System.IO;

namespace LoginMapApi.Controllers;

[Authorize]
[ApiController]
[Route("api/[controller]")]
public class UsersController : ControllerBase
{
    private readonly AppDbContext _context;

    public UsersController(AppDbContext context)
    {
        _context = context;
    }

    [AdminOnly]
    [HttpGet]
    public async Task<IActionResult> GetUsers()
    {
        var users = await _context.Users
            .Where(u => !u.IsDeleted)
            .OrderBy(u => u.Id)
            .Select(u => new
            {
                u.Id,
                u.Username,
                u.ProfileImageUrl,
                u.IsActive
            })
            .ToListAsync();

        return Ok(users);
    }

    [HttpGet("me")]
    public async Task<IActionResult> GetMe()
    {
        var userId = GetCurrentUserId();

        if (userId == null)
            return Unauthorized("Token içinde kullanıcı id bulunamadı.");

        var user = await _context.Users
            .Where(u => u.Id == userId.Value && !u.IsDeleted)
            .Select(u => new
            {
                u.Id,
                u.Username,
                u.ProfileImageUrl,
                u.IsActive
            })
            .FirstOrDefaultAsync();

        if (user == null)
            return NotFound("Kullanıcı bulunamadı.");

        return Ok(new
        {
            user.Id,
            user.Username,
            user.ProfileImageUrl,
            user.IsActive
        });
    }

    [AdminOnly]
    [HttpPost]
    public async Task<IActionResult> CreateUser(User user)
    {
        user.Id = 0;
        user.IsActive = true;
        user.IsDeleted = false;
        user.CreatedDate = DateTime.UtcNow;
        user.Password = BCrypt.Net.BCrypt.HashPassword(user.Password);

        _context.Users.Add(user);
        await _context.SaveChangesAsync();

        return Ok(new
        {
            user.Id,
            user.Username,
            user.ProfileImageUrl,
            user.IsActive
        });
    }

    [HttpPost("upload-profile-image")]
    public async Task<IActionResult> UploadProfileImage([FromForm] IFormFile file)
    {
        var userId = GetCurrentUserId();

        if (userId == null)
            return Unauthorized("Token içinde kullanıcı id bulunamadı.");

        var user = await _context.Users.FindAsync(userId.Value);

        if (user == null || user.IsDeleted)
            return NotFound("Kullanıcı bulunamadı.");

        if (file == null || file.Length == 0)
            return BadRequest("Dosya seçilmedi.");

        var allowedExtensions = new[] { ".jpg", ".jpeg", ".png", ".webp" };
        var extension = Path.GetExtension(file.FileName).ToLower();

        if (!allowedExtensions.Contains(extension))
            return BadRequest("Sadece jpg, jpeg, png veya webp yüklenebilir.");

        var folderPath = Path.Combine(
            Directory.GetCurrentDirectory(),
            "wwwroot",
            "profile-images"
        );

        if (!Directory.Exists(folderPath))
            Directory.CreateDirectory(folderPath);

        var fileName = $"user-{user.Id}-{Guid.NewGuid()}{extension}";
        var filePath = Path.Combine(folderPath, fileName);

        using (var stream = new FileStream(filePath, FileMode.Create))
        {
            await file.CopyToAsync(stream);
        }

        user.ProfileImageUrl = $"/profile-images/{fileName}";
        user.ModifiedDate = DateTime.UtcNow;

        await _context.SaveChangesAsync();

        return Ok(new
        {
            profileImageUrl = user.ProfileImageUrl
        });
    }

    [AdminOnly]
    [HttpPut("{id}")]
    public async Task<IActionResult> UpdateUser(int id, User request)
    {
        var user = await _context.Users.FindAsync(id);

        if (user == null || user.IsDeleted)
            return NotFound("Kullanıcı bulunamadı.");

        user.Username = request.Username;

        if (!string.IsNullOrWhiteSpace(request.Password))
        {
            user.Password = BCrypt.Net.BCrypt.HashPassword(request.Password);
        }

        user.IsActive = request.IsActive;
        user.ModifiedDate = DateTime.UtcNow;

        await _context.SaveChangesAsync();

        return Ok(new
        {
            user.Id,
            user.Username,
            user.ProfileImageUrl,
            user.IsActive
        });
    }

    [AdminOnly]
    [HttpDelete("{id}")]
    public async Task<IActionResult> DeleteUser(int id)
    {
        var user = await _context.Users.FindAsync(id);

        if (user == null || user.IsDeleted)
            return NotFound("Kullanıcı bulunamadı.");

        user.IsDeleted = true;
        user.IsActive = false;
        user.ModifiedDate = DateTime.UtcNow;

        await _context.SaveChangesAsync();

        return Ok("Kullanıcı silindi.");
    }

    private int? GetCurrentUserId()
    {
        var value =
            User.FindFirstValue(ClaimTypes.NameIdentifier) ??
            User.FindFirstValue("nameid") ??
            User.FindFirstValue("sub") ??
            User.FindFirstValue("id");

        return int.TryParse(value, out var id) ? id : null;
    }
}