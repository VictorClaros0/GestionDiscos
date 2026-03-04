using Microsoft.EntityFrameworkCore;
using SocketsProof;
using SocketsProof.Models;

var builder = WebApplication.CreateBuilder(args);

// Add services to the container.
builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

// Configurar DbContext
builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseSqlServer(builder.Configuration.GetConnectionString("DefaultConnection")));

// Agregar servicio de sockets
builder.Services.AddHostedService<SocketService>();

// Agregar servicio de detección de nodos "No Reporta"
builder.Services.AddHostedService<NodeHealthChecker>();

// Configurar CORS para permitir cualquier origen
var corsPolicy = "_myCorsPolicy";

builder.Services.AddCors(options =>
{
    options.AddPolicy(name: corsPolicy,
        policy =>
        {
            policy.AllowAnyOrigin()  // Permite cualquier origen
                  .AllowAnyHeader()  // Permite cualquier encabezado
                  .AllowAnyMethod(); // Permite cualquier m�todo (GET, POST, etc.)
        });
});

var app = builder.Build();

// Swagger habilitado en todos los entornos
app.UseSwagger();
app.UseSwaggerUI();

app.UseHttpsRedirection();

// Aplicar CORS antes de la autorizaci�n
app.UseCors(corsPolicy);

app.UseAuthorization();

app.MapControllers();

app.Run();
