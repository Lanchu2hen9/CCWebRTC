# Simple WebRTC Video Chat with Deno KV Signaling

This project demonstrates a rudimentary video chat application that uses WebRTC for peer-to-peer video and audio streaming, as well as a simple chatbox functionality via WebRTC Data Channels. The signaling required to establish the WebRTC connection is handled by a Deno server using Deno KV as a temporary message store.

## How it Works

### WebRTC Fundamentals

WebRTC (Web Real-Time Communication) is a technology that enables direct peer-to-peer communication between web browsers (and mobile applications) for video, audio, and generic data transfer without requiring an intermediary server for the media itself once the connection is established.

The process of establishing a WebRTC connection involves several steps:

1.  **Media Access**: Each client (browser) needs to access the user's camera and microphone. This is done using `navigator.mediaDevices.getUserMedia()`.
2.  **Signaling**: This is the crucial process where the two peers exchange information necessary to connect. This information includes:
    *   **Session Description Protocol (SDP) Offers and Answers**: One peer (the "initiator") creates an "offer" (an SDP message describing its media capabilities, codecs, etc.). This offer is sent to the other peer via a signaling channel. The second peer receives the offer, creates an "answer" (its own SDP message), and sends it back.
    *   **Interactive Connectivity Establishment (ICE) Candidates**: To traverse NATs (Network Address Translators) and firewalls, WebRTC uses the ICE framework. Peers gather ICE candidates (potential IP address and port pairs) and exchange them. These candidates can be:
        *   **Host candidates**: Direct IP address of the client on its local network.
        *   **Server Reflexive (srflx) candidates**: Public IP address and port as seen by a STUN server.
        *   **Relay (relay) candidates**: IP address and port of a TURN server, used if direct P2P connection fails.
3.  **Peer Connection (`RTCPeerConnection`)**: Both clients create an `RTCPeerConnection` object. This object manages the entire WebRTC connection lifecycle, including adding local media tracks, handling remote tracks, and managing the ICE process.
4.  **Data Channels (`RTCDataChannel`)**: For sending arbitrary data (like chat messages) directly between peers, WebRTC provides Data Channels.

Once signaling is complete and a suitable pair of ICE candidates is found, the browsers establish a direct peer-to-peer connection for media and data.

### Signaling with Deno and Deno KV

In this project, a Deno server (`server.js`) acts as the signaling intermediary. It does **not** handle any video or audio streams itself; it only passes messages between the two clients trying to connect. Deno KV is used as a simple, temporary key-value store for these messages.

**Signaling Flow:**

1.  **Client A (Initiator)**:
    *   Starts the session.
    *   Checks Deno KV (via a `GET` request to `/signal` on the Deno server) for an existing "offer" for the `default-room`.
    *   If no offer exists, Client A becomes the initiator.
    *   It creates an SDP offer using `peerConnection.createOffer()` and sets its local description.
    *   It sends this offer object to the Deno server (`POST /signal` with `type: "offer"`, `payload: <offer_sdp_object>`).
    *   The server stores this offer in Deno KV, keyed by `["webrtc_signal", "default-room", "offer"]`.
2.  **Client B (Receiver)**:
    *   Starts the session.
    *   Checks Deno KV for an "offer". It finds Client A's offer.
    *   It sets Client A's offer as its remote description.
    *   It creates an SDP answer using `peerConnection.createAnswer()` and sets its local description.
    *   It sends this answer to the Deno server (`POST /signal` with `type: "answer"`, `payload: <answer_sdp_object>`).
    *   The server stores this answer in Deno KV, keyed by `["webrtc_signal", "default-room", "answer"]`.
    *   Client B then deletes the "offer" from Deno KV (`DELETE /signal?type=offer`).
3.  **ICE Candidate Exchange (Simplified - Current Implementation stores one candidate per type):**
    *   As each client's `RTCPeerConnection` gathers ICE candidates (`onicecandidate` event):
        *   The initiator sends its candidates to the server with `type: "candidate_initiator"`.
        *   The receiver sends its candidates to the server with `type: "candidate_receiver"`.
        *   The server stores these, overwriting the previous candidate of the same type for the room.
    *   **Polling for Candidates:**
        *   The initiator periodically polls the server (`GET /signal?type=candidate_receiver`) for candidates sent by the receiver. When received, it adds them using `peerConnection.addIceCandidate()` and then deletes the candidate message from the server.
        *   The receiver periodically polls for `candidate_initiator` and does the same.
    *   **(More Robust Implementation - Current as of last update):**
        *   When sending candidates, the client specifies `type: "candidate_initiator"` (if initiator) or `type: "candidate_receiver"` (if receiver).
        *   The server stores these under unique keys (e.g., `["webrtc_signal", "default-room", "candidates_for_receiver", <UUID>]` for candidates from the initiator).
        *   When polling, if the initiator requests `type: "candidate_receiver"`, the server lists all keys under `["webrtc_signal", "default-room", "candidates_for_initiator"]` and returns them as an array (each with its payload and full KV key).
        *   The client processes each candidate from the array and then sends a `DELETE` request to the server specifying the unique KV key of that candidate to remove it.
4.  **Connection Established**: Once enough ICE candidates are exchanged and a path is found, the peer connection transitions to `connected`. Video/audio streams flow, and the data channel opens for chat.
5.  **Hang Up**: When a user clicks "Hang Up":
    *   The `RTCPeerConnection` is closed.
    *   Local media tracks are stopped.
    *   An attempt is made to clear all associated signaling messages (offer, answer, candidates for both sides) from Deno KV for the `default-room`.

## Project Structure

*   `server.js`: The Deno HTTP server.
    *   Serves static files from the `/public` directory.
    *   Handles signaling messages at the `/signal` endpoint, using Deno KV for storage.
    *   Provides an `/api/ice-servers` endpoint to fetch STUN/TURN configurations (e.g., from Twilio).
*   `public/`: Contains client-side files.
    *   `index.html`: The main HTML page with video elements and chat UI.
    *   `client.js`: Handles all client-side WebRTC logic, DOM manipulation, and communication with the signaling server.
    *   `style.css`: Basic styling for the page.
*   `.env`: For storing API keys and other sensitive configuration (e.g., Twilio credentials). **This file should NOT be committed to version control.**
*   `deno.json`: Deno configuration file, defining tasks for running, formatting, and linting.
*   `clear_kv.js`: A utility Deno script to clear WebRTC signaling data from the Deno KV store for the `default-room`.

## Setting Up and Running

1.  **Install Deno**: If you don't have it, install Deno from [deno.land](https://deno.land/).
2.  **Clone the Repository** (or ensure you have the project files).
3.  **STUN/TURN Server Configuration (Optional but Recommended for Reliability):**
    WebRTC connections often need STUN and TURN servers to reliably traverse NATs and firewalls.
    *   **STUN (Session Traversal Utilities for NAT)**: Helps peers discover their public IP addresses.
    *   **TURN (Traversal Using Relays around NAT)**: Acts as a relay if a direct peer-to-peer connection fails. This is crucial for many network configurations.

    This project is configured to fetch STUN/TURN server details from Twilio.
    *   Create a file named `.env` in the root of the `lanchu_template` directory.
    *   Add your Twilio Account SID and Auth Token to it:
        ```env
        # lanchu_template/.env
        TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
        TWILIO_AUTH_TOKEN=your_auth_token_xxxxxxxxxxxxxx
        ```
    *   **Security Precaution**: Ensure your `.env` file is listed in your project's `.gitignore` file to prevent accidentally committing sensitive credentials. If you don't have a `.gitignore`, create one and add `.env` to it.
    *   If you don't provide Twilio credentials, the application will fall back to using only Google's public STUN server, which may result in connection failures in some network environments.
4.  **Run the Server**:
    Navigate to the `lanchu_template` directory in your terminal and run:
    ```bash
    deno task start
    ```
    This command (defined in `deno.json`) runs `server.js` with the necessary Deno permissions (`--allow-net`, `--allow-read`, `--allow-write` for KV, and `--allow-env` for the `.env` file, plus `--unstable-kv`).
5.  **Open in Browser(s)**:
    Open `http://localhost:8000` in two different browser tabs (or two different browsers on the same machine, or different machines on the same local network if STUN works, or different networks if TURN is set up and working).
6.  **Start Chatting**:
    *   Click "Start Session" in the first tab. This tab becomes the "initiator".
    *   Click "Start Session" in the second tab. This tab becomes the "receiver".
    *   If signaling and ICE negotiation are successful, you should see your local video in one box and the remote video in the other. The chatbox should also become active.

## Clearing Deno KV (for testing and development)

If you encounter issues with stale signaling data, or if WebRTC connections behave erratically (e.g., work once and then fail on subsequent attempts without a full browser cache clear and server restart), you might need to clear the WebRTC signaling entries from Deno KV.

A Deno task is provided for this:

1.  **Stop the main Deno server** (`server.js`) if it's currently running. This is important to avoid potential conflicts or race conditions if the server tries to access KV while you're clearing it.
2.  Run the `clear-kv` task from the `lanchu_template` directory:
    ```bash
    deno task clear-kv
    ```
    This task executes the `clear_kv.js` script, which will remove all signaling data associated with the `default-room`.
3.  After the script confirms deletion, you can restart the main Deno server (`deno task start`).

**When to use `deno task clear-kv`:**

*   Before starting a fresh testing session, especially if previous sessions ended abruptly or experienced connection issues.
*   If you suspect stale offers, answers, or ICE candidates are interfering with new connection attempts.
*   During development, if you've made changes to the signaling logic and want to ensure no old data structures are causing problems.

This ensures a clean state for the signaling mechanism.

## Acknowledgement

This project, including its structure, code for WebRTC logic, Deno server implementation, Deno KV signaling mechanism, and this README file, was generated with the assistance of a large language model AI. I, the AI, helped outline the components, write the code for both client and server, debug issues, and explain the underlying mechanics.