# ---------- build ----------
FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src

COPY LoginMapApi.csproj ./
RUN dotnet restore LoginMapApi.csproj

COPY . ./
RUN dotnet publish LoginMapApi.csproj -c Release -o /app/publish --no-restore

# ---------- run ----------
FROM mcr.microsoft.com/dotnet/aspnet:8.0
WORKDIR /app

COPY --from=build /app/publish ./

# Render gibi platformlar portu PORT ortam değişkeniyle verir.
ENV ASPNETCORE_ENVIRONMENT=Production
EXPOSE 8080
ENTRYPOINT ["sh", "-c", "ASPNETCORE_URLS=http://0.0.0.0:${PORT:-8080} exec dotnet LoginMapApi.dll"]
