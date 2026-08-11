using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace LoginMapApi.Migrations
{
    /// <inheritdoc />
    public partial class AddOsrmRouteFields : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AlterColumn<string>(
                name: "ShortCode",
                table: "TransitRoutes",
                type: "character varying(10)",
                maxLength: 10,
                nullable: false,
                oldClrType: typeof(string),
                oldType: "text");

            migrationBuilder.AddColumn<double>(
                name: "DistanceMeters",
                table: "TransitRoutes",
                type: "double precision",
                nullable: true);

            migrationBuilder.AddColumn<double>(
                name: "DurationSeconds",
                table: "TransitRoutes",
                type: "double precision",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "RouteUpdatedDate",
                table: "TransitRoutes",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "RouteWkt",
                table: "TransitRoutes",
                type: "text",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_TransitRoutes_ShortCode",
                table: "TransitRoutes",
                column: "ShortCode");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_TransitRoutes_ShortCode",
                table: "TransitRoutes");

            migrationBuilder.DropColumn(
                name: "DistanceMeters",
                table: "TransitRoutes");

            migrationBuilder.DropColumn(
                name: "DurationSeconds",
                table: "TransitRoutes");

            migrationBuilder.DropColumn(
                name: "RouteUpdatedDate",
                table: "TransitRoutes");

            migrationBuilder.DropColumn(
                name: "RouteWkt",
                table: "TransitRoutes");

            migrationBuilder.AlterColumn<string>(
                name: "ShortCode",
                table: "TransitRoutes",
                type: "text",
                nullable: false,
                oldClrType: typeof(string),
                oldType: "character varying(10)",
                oldMaxLength: 10);
        }
    }
}
