using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace SocketsProof.Migrations
{
    /// <inheritdoc />
    public partial class AddBidirectionalSupport : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "Client",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    name = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    mac = table.Column<string>(type: "nvarchar(450)", nullable: true),
                    Hostname = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    OS = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    IP = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    Status = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    LastSeen = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Client", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "Commands",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    NodeId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    CommandText = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    SentAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    Status = table.Column<string>(type: "nvarchar(max)", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Commands", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Commands_Client_NodeId",
                        column: x => x.NodeId,
                        principalTable: "Client",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "DiskLog",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    totalMemory = table.Column<int>(type: "int", nullable: false),
                    freeMemory = table.Column<int>(type: "int", nullable: false),
                    UsagePercent = table.Column<double>(type: "float", nullable: false),
                    Iops = table.Column<int>(type: "int", nullable: false),
                    Timestamp = table.Column<DateTime>(type: "datetime2", nullable: false),
                    clientId = table.Column<Guid>(type: "uniqueidentifier", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_DiskLog", x => x.id);
                    table.ForeignKey(
                        name: "FK_DiskLog_Client_clientId",
                        column: x => x.clientId,
                        principalTable: "Client",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "CommandAcks",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    CommandId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    AckedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    Response = table.Column<string>(type: "nvarchar(max)", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CommandAcks", x => x.Id);
                    table.ForeignKey(
                        name: "FK_CommandAcks_Commands_CommandId",
                        column: x => x.CommandId,
                        principalTable: "Commands",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_Client_LastSeen",
                table: "Client",
                column: "LastSeen");

            migrationBuilder.CreateIndex(
                name: "IX_Client_Mac",
                table: "Client",
                column: "mac",
                unique: true,
                filter: "[mac] IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "IX_CommandAcks_CommandId",
                table: "CommandAcks",
                column: "CommandId",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Commands_NodeId",
                table: "Commands",
                column: "NodeId");

            migrationBuilder.CreateIndex(
                name: "IX_DiskLog_ClientId_Timestamp",
                table: "DiskLog",
                columns: new[] { "clientId", "Timestamp" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "CommandAcks");

            migrationBuilder.DropTable(
                name: "DiskLog");

            migrationBuilder.DropTable(
                name: "Commands");

            migrationBuilder.DropTable(
                name: "Client");
        }
    }
}
