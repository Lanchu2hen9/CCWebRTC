// Deno script to clear WebRTC signaling entries from Deno KV
// To run: deno run --allow-read --allow-write --unstable-kv clear_kv.js

async function clearWebRTCSignals() {
  let kv;
  try {
    console.log("Attempting to open Deno KV store...");
    kv = await Deno.openKv();
    console.log("Deno KV store opened successfully.");

    const roomToClear = "default-room"; // Or make this configurable if needed
    const prefix = ["webrtc_signal", roomToClear];
    
    console.log(`\nLooking for entries with prefix: [${prefix.map(p => `"${p}"`).join(", ")}] to delete...`);

    const entriesToDelete = [];
    for await (const entry of kv.list({ prefix })) {
      entriesToDelete.push(entry.key);
    }

    if (entriesToDelete.length === 0) {
      console.log("No entries found with the specified prefix. Nothing to delete.");
      return;
    }

    console.log(`Found ${entriesToDelete.length} entries to delete. Deleting now...`);
    let deletedCount = 0;
    for (const key of entriesToDelete) {
      try {
        await kv.delete(key);
        console.log(`  Deleted key: [${key.map(k => typeof k === 'string' ? `"${k}"` : k).join(", ")}]`);
        deletedCount++;
      } catch (e) {
        console.error(`  Error deleting key [${key.map(k => typeof k === 'string' ? `"${k}"` : k).join(", ")}]:`, e);
      }
    }
    
    console.log(`\nFinished. Successfully deleted ${deletedCount} entries.`);

  } catch (error) {
    console.error("Error during KV operation:", error);
    if (error.name === "PermissionDenied") {
      console.error("Please ensure you have --allow-read and --allow-write permissions for Deno KV.");
    }
  } finally {
    if (kv) {
      kv.close();
      console.log("Deno KV store closed.");
    }
  }
}

if (import.meta.main) {
  clearWebRTCSignals();
}