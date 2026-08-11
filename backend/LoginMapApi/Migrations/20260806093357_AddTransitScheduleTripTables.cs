using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace LoginMapApi.Migrations
{
    /// <inheritdoc />
    public partial class AddTransitScheduleTripTables : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "TransitSchedules",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    TransitRouteId = table.Column<int>(type: "integer", nullable: false),
                    Name = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    ValidFrom = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    ValidTo = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    RunsMonday = table.Column<bool>(type: "boolean", nullable: false),
                    RunsTuesday = table.Column<bool>(type: "boolean", nullable: false),
                    RunsWednesday = table.Column<bool>(type: "boolean", nullable: false),
                    RunsThursday = table.Column<bool>(type: "boolean", nullable: false),
                    RunsFriday = table.Column<bool>(type: "boolean", nullable: false),
                    RunsSaturday = table.Column<bool>(type: "boolean", nullable: false),
                    RunsSunday = table.Column<bool>(type: "boolean", nullable: false),
                    IsActive = table.Column<bool>(type: "boolean", nullable: false),
                    IsDeleted = table.Column<bool>(type: "boolean", nullable: false),
                    CreatedDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    ModifiedDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    ModifiedUserId = table.Column<int>(type: "integer", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_TransitSchedules", x => x.Id);
                    table.ForeignKey(
                        name: "FK_TransitSchedules_TransitRoutes_TransitRouteId",
                        column: x => x.TransitRouteId,
                        principalTable: "TransitRoutes",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "TransitTrips",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    TransitRouteId = table.Column<int>(type: "integer", nullable: false),
                    TransitScheduleId = table.Column<int>(type: "integer", nullable: false),
                    TripCode = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                    VehicleType = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false, defaultValue: "Bus"),
                    DepartureTime = table.Column<TimeOnly>(type: "time without time zone", nullable: false),
                    IsActive = table.Column<bool>(type: "boolean", nullable: false),
                    IsDeleted = table.Column<bool>(type: "boolean", nullable: false),
                    CreatedDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    ModifiedDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    ModifiedUserId = table.Column<int>(type: "integer", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_TransitTrips", x => x.Id);
                    table.ForeignKey(
                        name: "FK_TransitTrips_TransitRoutes_TransitRouteId",
                        column: x => x.TransitRouteId,
                        principalTable: "TransitRoutes",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_TransitTrips_TransitSchedules_TransitScheduleId",
                        column: x => x.TransitScheduleId,
                        principalTable: "TransitSchedules",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "TransitTripStops",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    TransitTripId = table.Column<int>(type: "integer", nullable: false),
                    TransitStopId = table.Column<int>(type: "integer", nullable: false),
                    StopSequence = table.Column<int>(type: "integer", nullable: false),
                    ArrivalOffsetSeconds = table.Column<int>(type: "integer", nullable: false),
                    DepartureOffsetSeconds = table.Column<int>(type: "integer", nullable: false),
                    DwellSeconds = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_TransitTripStops", x => x.Id);
                    table.ForeignKey(
                        name: "FK_TransitTripStops_TransitStops_TransitStopId",
                        column: x => x.TransitStopId,
                        principalTable: "TransitStops",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_TransitTripStops_TransitTrips_TransitTripId",
                        column: x => x.TransitTripId,
                        principalTable: "TransitTrips",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_TransitSchedules_TransitRouteId",
                table: "TransitSchedules",
                column: "TransitRouteId");

            migrationBuilder.CreateIndex(
                name: "IX_TransitSchedules_TransitRouteId_Name",
                table: "TransitSchedules",
                columns: new[] { "TransitRouteId", "Name" });

            migrationBuilder.CreateIndex(
                name: "IX_TransitTrips_TransitRouteId_DepartureTime",
                table: "TransitTrips",
                columns: new[] { "TransitRouteId", "DepartureTime" });

            migrationBuilder.CreateIndex(
                name: "IX_TransitTrips_TransitScheduleId",
                table: "TransitTrips",
                column: "TransitScheduleId");

            migrationBuilder.CreateIndex(
                name: "IX_TransitTrips_TripCode",
                table: "TransitTrips",
                column: "TripCode",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_TransitTripStops_TransitStopId",
                table: "TransitTripStops",
                column: "TransitStopId");

            migrationBuilder.CreateIndex(
                name: "IX_TransitTripStops_TransitTripId_StopSequence",
                table: "TransitTripStops",
                columns: new[] { "TransitTripId", "StopSequence" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_TransitTripStops_TransitTripId_TransitStopId",
                table: "TransitTripStops",
                columns: new[] { "TransitTripId", "TransitStopId" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "TransitTripStops");

            migrationBuilder.DropTable(
                name: "TransitTrips");

            migrationBuilder.DropTable(
                name: "TransitSchedules");
        }
    }
}
