import Source from "../Source";
class MyShipTracking extends Source {
  parseLocation = async function (result: any) {
    const location = {
      timestamp: result.timestamp,
      latitude: result.latitude,
      longitude: result.longitude,
      course: result.course,
      speed: result.speed,
      source: "myshiptracking.com",
      source_type: "AIS",
    };
    return location;
  };

  // the method in the sources class does not work if no seconds are in the string
  dmsToDecimalDegreesMST = function (dms) {
    console.log(dms);
    return parseFloat(dms);
  };

  getLocation = async (mmsi: number) => {
    const result = await this.fetch(
      "https://www.myshiptracking.com/vessels/mmsi-" + mmsi,
      {
        accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
        "accept-language": "de-DE,de;q=0.6",
        "cache-control": "max-age=0",
        "sec-ch-ua":
          '"Chromium";v="116", "Not)A;Brand";v="24", "Brave";v="116"',
        "sec-ch-ua-mobile": "?0",
        "sec-ch-ua-platform": '"macOS"',
        "sec-fetch-dest": "document",
        "sec-fetch-mode": "navigate",
        "sec-fetch-site": "none",
        "sec-fetch-user": "?1",
        "sec-gpc": "1",
        "upgrade-insecure-requests": "1",
        cookie:
          "usr_lang_exist=1; port_tz=LT; user_tz=MT; user_df=1; session_id_sp_trk=fd1i0pb2mt6i4nra9c1mejsmvk; offset=Europe%2FBerlin; usr_lang_exist=1; io=ilOBwd-Xh9Z1fGzpFaM0",
      },
      "GET",
    );

    // Parse the labelled <th>/<td> rows. NOTE: myshiptracking no longer puts
    // the coordinates in these cells (they render "---" server-side and are
    // filled in client-side), so Latitude/Longitude come from the map script
    // below. Speed and the "Position Received" timestamp are still here.
    const pattern =
      /<th>(Longitude|Latitude|Course|Speed|Position Received)<\/th>\s*<td>(.*?)<\/td>/gs;
    const extractedData: any = {};
    let match;
    while ((match = pattern.exec(result)) !== null) {
      extractedData[match[1]] = match[2];
    }

    // The authoritative lat/lon/course are emitted into the page as a call to
    // canvas_map_generate("map_locator", <zoom>, <lat>, <lon>, <course>, ...).
    const mapMatch = result.match(
      /canvas_map_generate\(\s*"[^"]*"\s*,\s*[\d.]+\s*,\s*(-?[\d.]+)\s*,\s*(-?[\d.]+)\s*,\s*(-?[\d.]+)/,
    );
    if (!mapMatch) {
      throw new Error(
        "Could not locate vessel coordinates in myshiptracking response (page layout may have changed or vessel has no recent position)",
      );
    }
    const latitude = parseFloat(mapMatch[1]);
    const longitude = parseFloat(mapMatch[2]);
    // AIS course over ground; 360/511 are "not available" sentinels.
    let course = parseFloat(mapMatch[3]);
    if (!isFinite(course) || course >= 360) {
      course = 0;
    }

    // Speed cell shows an anchor icon when the vessel is moored/stopped.
    const speedCell = extractedData.Speed ?? "";
    const speed = /fa-anchor/.test(speedCell)
      ? 0
      : parseFloat(speedCell.replace(/<[^>]*>/g, "")) || 0;

    // "Position Received" cell carries the exact timestamp in a title attribute,
    // e.g. title="2026-06-01 00:08".
    let timestamp = new Date().toISOString();
    const titleMatch = (extractedData["Position Received"] ?? "").match(
      /title="(\d{4}-\d{2}-\d{2} \d{2}:\d{2})/,
    );
    if (titleMatch?.[1]) {
      const [datePart, timePart] = titleMatch[1].split(" ");
      const [year, month, day] = datePart.split("-").map(Number);
      const [hour, minute] = timePart.split(":").map(Number);
      timestamp = new Date(
        Date.UTC(year, month - 1, day, hour, minute),
      ).toISOString();
    }

    const position = {
      latitude,
      longitude,
      course,
      speed,
      timestamp,
    };
    console.log(position);
    // verifyPosition checks the AIS-style { lat, lon } shape.
    this.verifyPosition({ lat: latitude, lon: longitude });
    return position;
  };
}

export default MyShipTracking;
