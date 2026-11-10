import { v4 as uuidv4 } from 'uuid';
import { env } from '../config/env';

interface SimulationState {
  temperature: number;
  humidity: number;
  battery: number;
  lat: number;
  lng: number;
  step: number;
}

const DEFAULT_SHIPMENT_ID = 'shipment-medswift-demo-01';

async function runSimulator() {
  const apiUrl = env.SIMULATOR_API_URL || 'http://localhost:3000/api/v1/telemetry/ingest';
  const loginUrl = apiUrl.replace('/telemetry/ingest', '/auth/login');
  const intervalMs = env.SIMULATOR_INTERVAL_MS || 30000;

  console.log('------------------------------------------------------------');
  console.log(' ColdChain Pulse - IoT Telemetry & Alert Engine Simulator ');
  console.log(' MedSwift Logistics Ltd. | Backend Team ');
  console.log(` Target Ingestion Endpoint: ${apiUrl}`);
  console.log(` Interval: ${intervalMs / 1000}s per reading`);
  console.log('------------------------------------------------------------');

  // Step 1: Authenticate as Driver to get JWT Token
  let token = '';
  try {
    const loginRes = await fetch(loginUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'driver@medswift.com',
        password: 'DriverPass123!'
      })
    });

    if (!loginRes.ok) {
      throw new Error(`Login failed with HTTP ${loginRes.status}: ${await loginRes.text()}`);
    }

    const loginData: any = await loginRes.json();
    token = loginData.data.token;
    console.log('[Simulator Auth] Authenticated as Driver successfully. Bearer token acquired.');
  } catch (err: any) {
    console.error('[Simulator Auth Error] Could not connect to API server. Ensure backend is running.', err.message);
    process.exit(1);
  }

  // Simulation State: Route from Dhaka to Chittagong
  const state: SimulationState = {
    temperature: 4.5,
    humidity: 48.0,
    battery: 99.0,
    lat: 23.8103, // Dhaka
    lng: 90.4125,
    step: 0
  };

  async function postReading() {
    state.step++;
    const readingId = uuidv4(); // Client-generated UUID

    // Realistic temperature profile with scenario progression:
    // Step 1-3: Normal operation (~4.5°C)
    // Step 4-6: Approaching Warning (~7.6°C)
    // Step 7-10: Critical Excursion (>8.0°C) lasting over time
    // Step 11+: Re-stabilization back to safe range (~4.2°C)
    if (state.step <= 3) {
      state.temperature = 4.2 + (Math.random() * 0.6 - 0.3);
    } else if (state.step <= 6) {
      state.temperature = 7.6 + (Math.random() * 0.3); // Approaching max threshold (8.0°C)
    } else if (state.step <= 10) {
      state.temperature = 9.4 + (Math.random() * 0.5); // Sustained excursion!
    } else {
      state.temperature = 4.0 + (Math.random() * 0.4); // Recovery
    }

    state.humidity = 45 + Math.random() * 10;
    state.battery = Math.max(10, state.battery - 0.1);
    state.lat += 0.005; // Moving along highway
    state.lng += 0.007;

    const payload = {
      id: readingId,
      shipmentId: DEFAULT_SHIPMENT_ID,
      temperature: parseFloat(state.temperature.toFixed(2)),
      humidity: parseFloat(state.humidity.toFixed(1)),
      batteryLevel: parseFloat(state.battery.toFixed(1)),
      latitude: parseFloat(state.lat.toFixed(4)),
      longitude: parseFloat(state.lng.toFixed(4)),
      recordedAt: new Date().toISOString()
    };

    try {
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      const resJson: any = await response.json();

      const timeStr = new Date().toLocaleTimeString();
      console.log(`[${timeStr}] Step ${state.step} | Temp: ${payload.temperature}°C | Hum: ${payload.humidity}% | GPS: (${payload.latitude}, ${payload.longitude}) | HTTP ${response.status}`);

      if (resJson.data?.alertsTriggered?.length > 0) {
        for (const alert of resJson.data.alertsTriggered) {
          const badge = alert.severity === 'CRITICAL' ? '🚨 [CRITICAL ALERT]' : '⚠️ [WARNING ALERT]';
          console.log(`   ${badge} ${alert.message}`);
        }
      }
    } catch (err: any) {
      console.error(`[Simulator Error] Failed posting reading step ${state.step}:`, err.message);
    }
  }

  // Initial reading immediately, then every interval
  console.log('[Simulator] Starting telemetry stream...');
  await postReading();
  setInterval(postReading, intervalMs);
}

runSimulator().catch(err => {
  console.error('[Simulator Fatal Error]:', err);
});
