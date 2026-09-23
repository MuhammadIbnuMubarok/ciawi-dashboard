// api/fleet.js - endpoint khusus fleet telemetri (kredensial disembunyikan di server)
const FLEET_URL = "https://sdatelemetry.com/API_ap_telemetry/datatelemetry.php?idbbws=1&user=sdatelem_icuadm&pass=Icupu2015";

module.exports = async (req, res) => {
  try {
    const up = await fetch(FLEET_URL, {
      headers: { "user-agent": "Mozilla/5.0 ciawi-dashboard-fleet" },
      cache: "no-store",
    });
    const buf = Buffer.from(await up.arrayBuffer());
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.setHeader("Cache-Control", "no-store");
    res.status(up.status).send(buf);
  } catch (e) {
    res.status(502).json({ error: "fleet gagal: " + e.message });
  }
};
