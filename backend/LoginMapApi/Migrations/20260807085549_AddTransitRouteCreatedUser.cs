using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace LoginMapApi.Migrations
{
    /// <inheritdoc />
    public partial class AddTransitRouteCreatedUser : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "CreatedUserId",
                table: "TransitRoutes",
                type: "integer",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_TransitRoutes_CreatedUserId",
                table: "TransitRoutes",
                column: "CreatedUserId");

            migrationBuilder.AddForeignKey(
                name: "FK_TransitRoutes_Users_CreatedUserId",
                table: "TransitRoutes",
                column: "CreatedUserId",
                principalTable: "Users",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_TransitRoutes_Users_CreatedUserId",
                table: "TransitRoutes");

            migrationBuilder.DropIndex(
                name: "IX_TransitRoutes_CreatedUserId",
                table: "TransitRoutes");

            migrationBuilder.DropColumn(
                name: "CreatedUserId",
                table: "TransitRoutes");
        }
    }
}
