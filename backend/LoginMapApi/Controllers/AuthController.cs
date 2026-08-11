using LoginMapApi.Data;
using Microsoft.AspNetCore.Mvc;
using Microsoft.IdentityModel.Tokens;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;

namespace LoginMapApi.Controllers;

[ApiController]
[Route("api/[controller]")]
public class AuthController : ControllerBase
{
    private readonly AppDbContext _context;
    private readonly string _jwtKey;

    public AuthController(
        AppDbContext context,
        IConfiguration configuration
    )
    {
        _context = context;

        _jwtKey =
            configuration["Jwt:Key"]
            ?? throw new InvalidOperationException(
                "JWT key configuration bulunamadı."
            );
    }

    [HttpPost("login")]
    public IActionResult Login([FromBody] LoginRequest request)
    {
        var username = request.Username.Trim();
        var password = request.Password.Trim();

        var user = _context.Users.FirstOrDefault(u =>
            u.Username == username &&
            u.IsActive == true &&
            u.IsDeleted == false
        );

        if (user == null)
        {
            return Unauthorized(new
            {
                message = "Kullanıcı adı veya şifre hatalı"
            });
        }

        var passwordCorrect =
            BCrypt.Net.BCrypt.Verify(
                password,
                user.Password
            );

        if (!passwordCorrect)
        {
            return Unauthorized(new
            {
                message = "Kullanıcı adı veya şifre hatalı"
            });
        }

        var claims = new[]
        {
            new Claim(
                ClaimTypes.NameIdentifier,
                user.Id.ToString()
            ),
            new Claim(
                ClaimTypes.Name,
                user.Username
            )
        };

        var key =
            new SymmetricSecurityKey(
                Encoding.UTF8.GetBytes(_jwtKey)
            );

        var creds =
            new SigningCredentials(
                key,
                SecurityAlgorithms.HmacSha256
            );

        var token =
            new JwtSecurityToken(
                claims: claims,
                expires: DateTime.UtcNow.AddMinutes(5),
                signingCredentials: creds
            );

        return Ok(new
        {
            token =
                new JwtSecurityTokenHandler()
                    .WriteToken(token),

            expiresInMinutes = 5
        });
    }

    [HttpPost("register")]
    public IActionResult Register(
        [FromBody] LoginRequest request
    )
    {
        var username = request.Username.Trim();
        var password = request.Password.Trim();

        var existingUser =
            _context.Users.FirstOrDefault(
                u => u.Username == username
            );

        if (existingUser != null)
        {
            return BadRequest(new
            {
                message = "Bu kullanıcı zaten var"
            });
        }

        var hashedPassword =
            BCrypt.Net.BCrypt.HashPassword(
                password
            );

        var user = new Models.User
        {
            Username = username,
            Password = hashedPassword,
            IsActive = true,
            IsDeleted = false,
            ModifiedDate = DateTime.UtcNow
        };

        _context.Users.Add(user);
        _context.SaveChanges();

        return Ok(new
        {
            message = "Kullanıcı oluşturuldu"
        });
    }
}

public class LoginRequest
{
    public string Username { get; set; } = "";

    public string Password { get; set; } = "";
}