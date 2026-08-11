import * as signalR from "@microsoft/signalr";

let connection = null;

export async function startVehicleConnection(token) {
  if (
    connection &&
    connection.state === signalR.HubConnectionState.Connected
  ) {
    return connection;
  }

  if (!connection) {
    connection = new signalR.HubConnectionBuilder()
      .withUrl("http://localhost:5075/hubs/vehicle", {
        accessTokenFactory: () => token,
      })
      .withAutomaticReconnect()
      .configureLogging(signalR.LogLevel.Information)
      .build();
  }

  if (
    connection.state === signalR.HubConnectionState.Disconnected
  ) {
    await connection.start();

    console.log(
      "Araç SignalR bağlantısı kuruldu."
    );
  }

  return connection;
}

export function getVehicleConnection() {
  return connection;
}

async function invokeVehicleHub(
  methodName,
  value
) {
  if (
    !connection ||
    connection.state !==
      signalR.HubConnectionState.Connected
  ) {
    return;
  }

  await connection.invoke(
    methodName,
    value
  );
}

/*
 * Bir güzergah üzerindeki bütün araçları dinler.
 * Çoklu araç kullanımında MapPage'in ana aboneliği budur.
 */
export async function joinVehicleRoute(routeId) {
  const normalizedRouteId = Number(routeId);

  if (
    !Number.isInteger(normalizedRouteId) ||
    normalizedRouteId <= 0
  ) {
    return;
  }

  await invokeVehicleHub(
    "JoinRouteGroup",
    normalizedRouteId
  );
}

export async function leaveVehicleRoute(routeId) {
  const normalizedRouteId = Number(routeId);

  if (
    !Number.isInteger(normalizedRouteId) ||
    normalizedRouteId <= 0
  ) {
    return;
  }

  await invokeVehicleHub(
    "LeaveRouteGroup",
    normalizedRouteId
  );
}

/*
 * İstenirse yalnızca belirli bir TransitTrip dinlenebilir.
 */
export async function joinVehicleTrip(tripId) {
  const normalizedTripId = Number(tripId);

  if (
    !Number.isInteger(normalizedTripId) ||
    normalizedTripId <= 0
  ) {
    return;
  }

  await invokeVehicleHub(
    "JoinTripGroup",
    normalizedTripId
  );
}

export async function leaveVehicleTrip(tripId) {
  const normalizedTripId = Number(tripId);

  if (
    !Number.isInteger(normalizedTripId) ||
    normalizedTripId <= 0
  ) {
    return;
  }

  await invokeVehicleHub(
    "LeaveTripGroup",
    normalizedTripId
  );
}

/*
 * Tek bir araç/simülasyon dinlemek için kullanılır.
 * simulationId backend'den gelen Guid stringidir.
 */
export async function joinVehicleSimulation(
  simulationId
) {
  const normalizedSimulationId =
    String(simulationId || "").trim();

  if (!normalizedSimulationId) {
    return;
  }

  await invokeVehicleHub(
    "JoinSimulationGroup",
    normalizedSimulationId
  );
}

export async function leaveVehicleSimulation(
  simulationId
) {
  const normalizedSimulationId =
    String(simulationId || "").trim();

  if (!normalizedSimulationId) {
    return;
  }

  await invokeVehicleHub(
    "LeaveSimulationGroup",
    normalizedSimulationId
  );
}

export async function stopVehicleConnection() {
  if (!connection) {
    return;
  }

  if (
    connection.state !==
      signalR.HubConnectionState.Disconnected
  ) {
    await connection.stop();
  }

  connection = null;

  console.log(
    "Araç SignalR bağlantısı kapatıldı."
  );
}
