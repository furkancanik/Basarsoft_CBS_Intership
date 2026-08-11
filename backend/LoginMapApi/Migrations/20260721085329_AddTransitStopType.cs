using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace LoginMapApi.Migrations
{
    /// <inheritdoc />
    public partial class AddTransitStopType : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "StopType",
                table: "TransitStops",
                type: "character varying(20)",
                maxLength: 20,
                nullable: false,
                defaultValue: "Bus");

            migrationBuilder.CreateIndex(
                name: "IX_TransitStops_StopType",
                table: "TransitStops",
                column: "StopType");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_TransitStops_StopType",
                table: "TransitStops");

            migrationBuilder.DropColumn(
                name: "StopType",
                table: "TransitStops");
        }
    }
}
