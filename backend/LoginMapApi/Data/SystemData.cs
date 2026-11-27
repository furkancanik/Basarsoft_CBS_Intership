namespace LoginMapApi.Data;

/*
 * Bütün kullanıcıların ortak gördüğü sistem verileri.
 *
 * İstanbul/Ankara raylı sistemleri ve bölge turları bu kullanıcılar
 * adına kayıtlıdır.
 * Kullanıcı pasif olduğu için giriş yapılamaz; hatlar herkese
 * görünür ama hiçbir kullanıcı tarafından değiştirilemez.
 */
public static class SystemData
{
    public const string IstanbulMetroUsername = "istanbul_metro";

    // Ankara raylı sistemleri ve bölge turları
    public const string TurkiyeHatlariUsername = "turkiye_hatlari";

    public static readonly string[] SystemUsernames =
    {
        IstanbulMetroUsername,
        TurkiyeHatlariUsername
    };
}
