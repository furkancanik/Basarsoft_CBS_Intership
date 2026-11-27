namespace LoginMapApi.Data;

/*
 * Bütün kullanıcıların ortak gördüğü sistem verileri.
 *
 * İstanbul metro hatları bu kullanıcı adına kayıtlıdır.
 * Kullanıcı pasif olduğu için giriş yapılamaz; hatlar herkese
 * görünür ama hiçbir kullanıcı tarafından değiştirilemez.
 */
public static class SystemData
{
    public const string IstanbulMetroUsername = "istanbul_metro";
}
