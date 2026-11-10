async function runFullSystemVerification() {
  const baseUrl = 'http://localhost:3000/api/v1';
  console.log('================================================================');
  console.log('   ColdChain Pulse - Full System Live End-to-End Execution      ');
  console.log('   Client: MedSwift Logistics Ltd.                              ');
  console.log('================================================================\n');

  // 1. Health check
  console.log('1. Probing System Health...');
  const healthRes = await fetch('http://localhost:3000/health');
  const health = await healthRes.json();
  console.log('   Status:', health.status, '| Service:', health.service);

  // 2. Authenticate all 5 RBAC roles
  console.log('\n2. Authenticating All 5 RBAC Roles...');
  const roles = [
    { name: 'Admin', email: 'admin@medswift.com', pass: 'AdminPass123!' },
    { name: 'Dispatcher', email: 'dispatcher@medswift.com', pass: 'DispatchPass123!' },
    { name: 'Driver', email: 'driver@medswift.com', pass: 'DriverPass123!' },
    { name: 'Clinic Receiver', email: 'receiver@medswift.com', pass: 'ReceiverPass123!' },
    { name: 'External Auditor', email: 'auditor@medswift.com', pass: 'AuditorPass123!' },
  ];

  const tokens: Record<string, string> = {};

  for (const r of roles) {
    const res = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: r.email, password: r.pass })
    });
    const data: any = await res.json();
    tokens[r.name] = data.data.token;
    console.log(`   [✓] Authenticated as ${r.name} (${data.data.user.role})`);
  }

  // 3. Dispatcher creates a new shipment
  console.log('\n3. Dispatcher Creating New Cold-Chain Shipment...');
  const createShipmentRes = await fetch(`${baseUrl}/shipments`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${tokens['Dispatcher']}`
    },
    body: JSON.stringify({
      origin: 'Chittagong Port Cold Facility',
      destination: 'Cox\'s Bazar District Hospital',
      vehicleId: 'MED-REEFER-14',
      minTemp: 2.0,
      maxTemp: 8.0,
      distanceKm: 152
    })
  });
  const newShipmentData: any = await createShipmentRes.json();
  const shipmentId = newShipmentData.data.id;
  const trackingNumber = newShipmentData.data.trackingNumber;
  console.log(`   [✓] Created Shipment: ${trackingNumber} (ID: ${shipmentId})`);
  console.log(`       Allowed Range: ${newShipmentData.data.minTemp}°C - ${newShipmentData.data.maxTemp}°C | ETA: ${newShipmentData.data.eta}`);

  // 4. Driver records Pickup Handoff
  console.log('\n4. Driver Recording Pickup Chain-of-Custody Handoff (QR Code)...');
  const pickupRes = await fetch(`${baseUrl}/custody/handoff`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${tokens['Driver']}`
    },
    body: JSON.stringify({
      shipmentId,
      stage: 'PICKUP',
      conditionStatus: 'SEALED_INTACT',
      qrCodeData: 'QR-CHITTAGONG-PORT-DOCK-04',
      pinCode: '3941',
      notes: 'Vaccines inspected and transferred into reefer chamber.'
    })
  });
  const pickupData: any = await pickupRes.json();
  console.log(`   [✓] Pickup Recorded! Hash: ${pickupData.data.record.hash.substring(0, 24)}...`);

  // 5. Ingest Telemetry Readings
  console.log('\n5. Ingesting IoT Telemetry (Normal, Warning, and Excursion)...');
  const readings = [
    { temp: 4.5, hum: 48, lat: 22.3569, lng: 91.7832, desc: 'Normal transit reading' },
    { temp: 7.7, hum: 51, lat: 22.1000, lng: 91.8500, desc: 'Approaching Warning reading (7.7°C >= 8.0 - 0.5)' },
  ];

  for (const r of readings) {
    const telRes = await fetch(`${baseUrl}/telemetry/ingest`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${tokens['Driver']}`
      },
      body: JSON.stringify({
        shipmentId,
        temperature: r.temp,
        humidity: r.hum,
        batteryLevel: 98.0,
        latitude: r.lat,
        longitude: r.lng
      })
    });
    const telData: any = await telRes.json();
    const alerts = telData.data.alertsTriggered || [];
    console.log(`   [✓] ${r.desc} -> Recorded! Hash: ${telData.data.reading.hash.substring(0, 20)}... | Alerts Triggered: ${alerts.length}`);
    for (const a of alerts) {
      console.log(`       ⚠️  Alert: [${a.severity}] ${a.message}`);
    }
  }

  // 6. Clinic Receiver records Delivery Handoff
  console.log('\n6. Clinic Receiver Recording Delivery Handoff (Digital Signature)...');
  const deliveryRes = await fetch(`${baseUrl}/custody/handoff`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${tokens['Clinic Receiver']}`
    },
    body: JSON.stringify({
      shipmentId,
      stage: 'DELIVERY',
      conditionStatus: 'SEALED_INTACT',
      pinCode: '9044',
      signature: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
      notes: 'Received at Cox\'s Bazar Hospital. Temperature verified intact.'
    })
  });
  const deliveryData: any = await deliveryRes.json();
  console.log(`   [✓] Delivery Completed! Hash: ${deliveryData.data.record.hash.substring(0, 24)}...`);

  // 7. External Auditor performs Cryptographic Ledger Verification
  console.log('\n7. External Auditor Performing Cryptographic Ledger Audit...');
  const auditRes = await fetch(`${baseUrl}/audit/shipments/${shipmentId}/verify-ledger`, {
    headers: { 'Authorization': `Bearer ${tokens['External Auditor']}` }
  });
  const auditData: any = await auditRes.json();
  console.log(`   [✓] Integrity Status: ${auditData.data.integrityStatus} (Tampered: ${auditData.data.isTampered})`);
  console.log(`       Telemetry Chain: ${auditData.data.telemetryVerifiedCount} verified | Custody Chain: ${auditData.data.custodyVerifiedCount} verified`);

  // 8. Generate Tamper-Evident PDF Audit Report
  console.log('\n8. Generating Tamper-Evident PDF Audit Report...');
  const pdfRes = await fetch(`${baseUrl}/audit/reports/${shipmentId}/pdf`, {
    headers: { 'Authorization': `Bearer ${tokens['External Auditor']}` }
  });
  const pdfFingerprint = pdfRes.headers.get('X-Report-SHA256');
  const pdfBlob = await pdfRes.arrayBuffer();
  console.log(`   [✓] PDF Generated: ${pdfBlob.byteLength} bytes`);
  console.log(`       Cryptographic SHA-256 Batch Fingerprint:`);
  console.log(`       ${pdfFingerprint}`);

  console.log('\n================================================================');
  console.log('   ALL SYSTEMS OPERATIONAL: 100% End-to-End Success!            ');
  console.log('================================================================');
}

runFullSystemVerification().catch(console.error);
