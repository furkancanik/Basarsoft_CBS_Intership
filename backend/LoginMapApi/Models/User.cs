namespace LoginMapApi.Models;

public class User
{
    public int Id { get; set; }

    public string Username { get; set; } = "";

    public string Password { get; set; } = "";

    public string? ProfileImageUrl { get; set; }

    public bool IsActive { get; set; } = true;

    public bool IsDeleted { get; set; } = false;

    public DateTime CreatedDate { get; set; } = DateTime.UtcNow;

    public DateTime? ModifiedDate { get; set; }
}