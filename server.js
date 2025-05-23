import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { serveDir } from "https://deno.land/std@0.190.0/http/file_server.ts";
import { load } from "jsr:@std/dotenv";

const PORT = 8000;
const PUBLIC_DIR_PATH = "./public"; // Relative to where server.js is

let kv;
let twilioAccountSid;
let twilioAuthToken;

try {
  // Load environment variables from .env file
  await load({ export: true }); // Exports to Deno.env
  twilioAccountSid = Deno.env.get("TWILIO_ACCOUNT_SID");
  twilioAuthToken = Deno.env.get("TWILIO_AUTH_TOKEN");

  if (!twilioAccountSid || !twilioAuthToken) {
    console.warn(
      "Twilio credentials (TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN) not found in .env file. TURN server functionality will be disabled.",
    );
  } else {
    console.log("Twilio credentials loaded successfully.");
  }

  kv = await Deno.openKv();
  console.log("Deno KV store opened successfully.");
} catch (error) {
  console.error("Failed during initial setup (Deno KV or Env Vars):", error);
  if (error.name === "PermissionDenied") {
    console.warn(
      "Ensure Deno has correct permissions. Run with: deno run --allow-net --allow-read --allow-write --allow-env --unstable-kv server.js",
    );
  } else {
    console.warn(
      "Signaling or TURN services might not work. Ensure Deno KV is enabled and .env file is present with correct permissions.",
    );
  }
}

async function fetchTwilioIceServers() {
  if (!twilioAccountSid || !twilioAuthToken) {
    console.log(
      "Twilio credentials not available, returning only public STUN.",
    );
    return [{ urls: "stun:stun.l.google.com:19302" }]; // Fallback or default
  }

  const twilioApiUrl = `https://api.twilio.com/2010-04-01/Accounts/${twilioAccountSid}/Tokens.json`;
  try {
    const response = await fetch(twilioApiUrl, {
      method: "POST",
      headers: {
        Authorization:
          "Basic " + btoa(`${twilioAccountSid}:${twilioAuthToken}`),
      },
    });

    if (!response.ok) {
      console.error(
        `Failed to fetch ICE servers from Twilio: ${response.status} ${await response.text()}`,
      );
      return [{ urls: "stun:stun.l.google.com:19302" }]; // Fallback
    }

    const data = await response.json();
    const iceServers = [
      { urls: "stun:stun.l.google.com:19302" },
      ...data.ice_servers,
    ];
    console.log(
      "Fetched ICE servers from Twilio:",
      iceServers.map((s) => s.urls),
    );
    return iceServers;
  } catch (error) {
    console.error("Error fetching ICE servers from Twilio:", error);
    return [{ urls: "stun:stun.l.google.com:19302" }];
  }
}

async function handler(req) {
  const url = new URL(req.url);
  const pathname = url.pathname;
  const method = req.method;

  console.log(`${method} ${pathname}`);

  if (pathname === "/api/ice-servers" && method === "GET") {
    try {
      const iceServers = await fetchTwilioIceServers();
      return new Response(JSON.stringify(iceServers), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    } catch (error) {
      console.error("Error providing ICE servers:", error);
      return new Response("Error fetching ICE server configuration", {
        status: 500,
      });
    }
  }

  if (pathname === "/signal" && kv) {
    const room = url.searchParams.get("room") || "default-room";
    const type = url.searchParams.get("type"); // For GET/DELETE of offer/answer, or to identify candidate type
    const candidateKeyParam = url.searchParams.get("candidateKey"); // For DELETE of specific candidate

    if (!room) {
      return new Response("Missing 'room' query parameter", { status: 400 });
    }

    if (method === "POST") {
      try {
        const signal = await req.json(); // Expects { type, payload }
        if (!signal.type || signal.payload === undefined) { // payload can be null for end-of-candidates marker if we were to send it
          return new Response(
            "Invalid signal data. Expected { type, payload }.",
            { status: 400 },
          );
        }

        let kvKey;
        if (signal.type === "offer" || signal.type === "answer") {
          kvKey = ["webrtc_signal", room, signal.type];
          await kv.set(kvKey, signal.payload);
          console.log(`Stored ${signal.type} for room '${room}'`);
        } else if (signal.type === "candidate_initiator") { // Candidate from initiator, for receiver
          kvKey = ["webrtc_signal", room, "candidates_for_receiver", crypto.randomUUID()];
          await kv.set(kvKey, signal.payload);
          console.log(`Stored initiator candidate for room '${room}', key: ${kvKey[3]}`);
        } else if (signal.type === "candidate_receiver") { // Candidate from receiver, for initiator
          kvKey = ["webrtc_signal", room, "candidates_for_initiator", crypto.randomUUID()];
          await kv.set(kvKey, signal.payload);
          console.log(`Stored receiver candidate for room '${room}', key: ${kvKey[3]}`);
        } else {
          return new Response("Invalid signal type for POST", { status: 400 });
        }
        
        return new Response(JSON.stringify({ message: "Signal stored" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      } catch (error) {
        console.error("Error processing POST /signal:", error);
        return new Response("Error storing signal: " + error.message, {
          status: 500,
        });
      }
    } else if (method === "GET") {
      if (!type) {
        return new Response("Missing 'type' query parameter for GET request", { status: 400 });
      }
      try {
        if (type === "offer" || type === "answer") {
          const kvEntry = await kv.get(["webrtc_signal", room, type]);
          if (kvEntry && kvEntry.value !== null) {
            console.log(`Retrieved ${type} for room '${room}'`);
            return new Response(
              JSON.stringify({ type: type, payload: kvEntry.value }),
              { status: 200, headers: { "Content-Type": "application/json" } },
            );
          }
        } else if (type === "candidate_initiator") { // Receiver is asking for initiator's candidates
          const candidates = [];
          const prefix = ["webrtc_signal", room, "candidates_for_receiver"];
          for await (const entry of kv.list({ prefix })) {
            candidates.push({ payload: entry.value, key: entry.key });
          }
          console.log(`Retrieved ${candidates.length} initiator candidates for room '${room}'`);
          return new Response(JSON.stringify(candidates), { // Return as an array
            status: 200, headers: { "Content-Type": "application/json" },
          });
        } else if (type === "candidate_receiver") { // Initiator is asking for receiver's candidates
          const candidates = [];
          const prefix = ["webrtc_signal", room, "candidates_for_initiator"];
          for await (const entry of kv.list({ prefix })) {
            candidates.push({ payload: entry.value, key: entry.key });
          }
          console.log(`Retrieved ${candidates.length} receiver candidates for room '${room}'`);
          return new Response(JSON.stringify(candidates), { // Return as an array
            status: 200, headers: { "Content-Type": "application/json" },
          });
        } else {
           return new Response("Invalid type for GET request", { status: 400 });
        }
        // If offer/answer not found or no candidates
        console.log(`No signal found for room '${room}', type '${type}'`);
        return new Response(JSON.stringify(type.startsWith("candidate") ? [] : null), { // Empty array for candidates, null for offer/answer
          status: 404, headers: { "Content-Type": "application/json" },
        });
      } catch (error) {
        console.error("Error processing GET /signal:", error);
        return new Response("Error retrieving signal: " + error.message, { status: 500 });
      }
    } else if (method === "DELETE") {
      try {
        if (candidateKeyParam) { // Deleting a specific candidate
          const parsedKey = JSON.parse(candidateKeyParam); // Key was stringified by client
          await kv.delete(parsedKey);
          console.log(`Deleted candidate with key ${candidateKeyParam} for room '${room}'`);
          return new Response(JSON.stringify({ message: "Candidate deleted" }), { status: 200 });
        } else if (type === "offer" || type === "answer") { // Deleting offer or answer
           if (!type) {
                return new Response("Missing 'type' query parameter for DELETE request of offer/answer", { status: 400 });
            }
          await kv.delete(["webrtc_signal", room, type]);
          console.log(`Deleted ${type} for room '${room}'`);
          return new Response(JSON.stringify({ message: `${type} deleted` }), { status: 200 });
        } else {
            // Note: We don't have a bulk delete for candidate types by just "type" anymore.
            // Client must delete specific candidates by their full key.
            // Or, for robust cleanup on hangup, client could iterate and delete, or server could have a special cleanup endpoint.
            console.warn(`DELETE request for type '${type}' without specific candidateKey not supported for bulk candidate deletion.`);
            return new Response("Invalid DELETE request. Must specify candidateKey for candidates, or type for offer/answer.", { status: 400 });
        }
      } catch (error) {
        console.error("Error processing DELETE /signal:", error);
        return new Response("Error deleting signal: " + error.message, { status: 500 });
      }
    } else {
      return new Response("Method not allowed for /signal", { status: 405 });
    }
  } else if (pathname === "/signal" && !kv) {
    return new Response(
      "Signaling service unavailable: Deno KV not initialized.",
      { status: 503 },
    );
  }

  // Serve static files
  try {
    const publicDirPath = Deno.realPathSync(PUBLIC_DIR_PATH);
    return await serveDir(req, {
      fsRoot: publicDirPath,
      urlRoot: "",
      showDirListing: true,
      enableCors: true,
    });
  } catch (error) {
    console.error(`Error serving static file ${pathname}:`, error);
    if (error instanceof Deno.errors.NotFound) {
      return new Response("Not Found", { status: 404 });
    }
    return new Response("Internal Server Error", { status: 500 });
  }
}

console.log(`HTTP server running. Access it at: http://localhost:${PORT}/`);
await serve(handler, { port: PORT });