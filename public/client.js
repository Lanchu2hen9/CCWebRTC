// #region Global
// Global ICE configuration, starts with a fallback
let iceConfiguration = {
  iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
};

//#region StartVars
const startButton = document.getElementById("startButton");
const StartSection = document.querySelector("#StartSection");
const NameInput = document.querySelector("#NameInput");
const StartButton = document.querySelector("#startButton");
const Loading = document.querySelector("#Loading");

let userName = "";
//#endregion

//#region VideoVars
const localVideo = document.getElementById("localVideo");
const VideoElement = document.querySelector("#localVideo");
const remoteVideo = document.getElementById("remoteVideo");
let localStream;
let remoteStream;
let peerConnection;
let dataChannel;
let isInitiator = false;
//#endregion

//#region Audio Vars
const RunningAudio = document.querySelector("#RunningAud");
RunningAudio.volume = 0.3;
RunningAudio.loop = true;

const Scream = document.querySelector("#MikeScrem");
Scream.volume = 0.3;
Scream.loop = false;

const YouSus = document.querySelector("#USus");
YouSus.volume = 0.3;
YouSus.loop = false;

//#region RunningBtn
const MouseSneak = 80;
const EdgePadding = 35;
//#endregion
//#endregion

//#region Call Int Vars
const hangupButton = document.getElementById("hangupButton");
const chatLog = document.getElementById("chatLog");
const chatInput = document.getElementById("chatInput");
const sendButton = document.getElementById("sendButton");

const CameraBtn = document.querySelector("#CamButton");
const CameraIcon = document.querySelector("#CamIcon");

const MuteBtn = document.querySelector("#MuteButton");
const MuteIcon = document.querySelector("#MuteIcon");
//#endregion

//#region Cnv Vars
// This is for the pixelate video effect.

const cnv = document.querySelector("#cnv_element");
const ctx = cnv.getContext("2d", { willReadFrequently: true });
//#endregion

//#region Bool Vars
let isMuted = false;
let isCameraOn = true;
let isPixelated = false;
let IsMikeScreaming = false;
let RunningAudPlaying = false;
//#endregion
const ROOM_ID = "default-room"; // Simple room ID for Deno KV signaling

// #endregion

// #region Start Section
document.addEventListener("DOMContentLoaded", () => {
  document.querySelector(".video-container").style.display = "none";
  document.querySelector(".controls").style.displahy = "none";
});

StartButton.addEventListener("click", async () => {
  userName = NameInput.value.trim();
  if (!userName) {
    alert("Need your name to start the call!.");
    return;
  }

  NameInput.style.display = "none";
  StartButton.disabled = "none";

  Loading.style.display = "block";

  try {
    // Step 5: Initialize WebRTC during the loading period
    await startSession();

    // Step 6: After delay, hide loading and show video
    setTimeout(() => {
      StartSection.style.display = "none";
      document.querySelector(".video-container").style.display = "flex";
      document.querySelector(".controls").style.display = "block";

      const LocalName = document.querySelector("#UsernameLocal");
      LocalName.textContent = userName;

      if (dataChannel && dataChannel.readyState === "open") {
        sendUsername();
      }
    }, 1500);
  } catch (error) {
    console.error("Error starting session:", error);
    // If error, revert to initial state
    Loading.style.display = "none";
    NameInput.style.display = "block";
    StartButton.style.display = "block";
    StartButton.disabled = false;
    NameInput.disabled = false;
  }
});

function sendUsername() {
  if (dataChannel && dataChannel.readyState === "open") {
    const messagePayload = {
      type: "username",
      username: userName,
    };
    dataChannel.send(JSON.stringify(messagePayload));
  }
}

NameInput.addEventListener("keypress", (event) => {
  if (event.key === "Enter") {
    event.preventDefault();
    StartButton.click();
  }
});
// #endregion

// #region Mute Button Behaviour:

//#region Run Away Logic

// let WindowWidth = window.innerWidth;
// let WindowHeight = window.innerHeight;
// // Getting the window dimesions so that the buttons
// // know the area in which it can run away to.

// window.addEventListener("resize", () => {
//   WindowWidth = window.innerWidth;
//   WindowHeight = window.innerHeight;
// });
// // Resizes the window dimensions.

//MuteButton Hitbox
// const InitialHitBox = MuteBtn.getBoundingClientRect();
// const LHitbox = InitialHitBox.left;
// const TopHitbox = InitialHitBox.top;

// Initial position of MuteBtn
MuteBtn.style.position = "absolute";
MuteBtn.style.left = "calc(50% - 125px)";
MuteBtn.style.top = "calc(100vh - 100px)";
MuteBtn.style.transform = "translate(15px, 10px)";

window.addEventListener("resize", () => {
  const buttonRect = MuteBtn.getBoundingClientRect();

  let currentLeft = buttonRect.left;
  let currentTop = buttonRect.top;

  const MaxLeft = window.innerWidth - buttonRect.width - EdgePadding;
  const MaxTop = window.innerHeight - buttonRect.height - EdgePadding;

  let newX = Math.min(Math.max(currentLeft, EdgePadding), MaxLeft);
  let newY = Math.min(Math.max(currentTop, EdgePadding), MaxTop);
  if (
    currentLeft < EdgePadding ||
    currentTop < EdgePadding ||
    currentLeft > MaxLeft ||
    currentTop > MaxTop
  ) {
    MuteBtn.style.transition = "all 0.2s ease-out";
    MuteBtn.style.left = `${newX}px`;
    MuteBtn.style.top = `${newY}px`;
  }
});

document.addEventListener("mousemove", (e) => {
  const buttonRect = MuteBtn.getBoundingClientRect();
  const buttonCenterX = buttonRect.left + buttonRect.width / 2;
  const buttonCenterY = buttonRect.top + buttonRect.height / 2;

  const mouseX = e.clientX;
  const mouseY = e.clientY;

  // const DistanceToLeft = buttonRect.left;
  // const DistanceToRight = WindowWidth - (buttonRect.left + buttonRect.width);
  // const DistanceToTop = buttonRect.top;
  // const DistanceToBottom = WindowHeight - (buttonRect.top + buttonRect.height);

  // VerticalDistance = DistanceToTop + DistanceToBottom - EdgePadding * 2;
  // horiDistance = DistanceToLeft + DistanceToRight - EdgePadding * 2;

  // the distance between the mouse and the button's center
  const distance = Math.sqrt(
    Math.pow(mouseX - buttonCenterX, 2) + Math.pow(mouseY - buttonCenterY, 2)
  );

  if (distance < MouseSneak) {
    let newX;
    let newY;
    if (!RunningAudPlaying) {
      RunningAudio.play()
        .then(() => {
          RunningAudPlaying = true;
          console.log("Running audio started playing.");
        })
        .catch((error) => {
          console.error("Error playing running audio:", error);
        });
    }

    for (let i = 0; i < 50; i++) {
      newX =
        Math.random() *
        (window.innerWidth - 2 * EdgePadding - buttonRect.width);
      newY =
        Math.random() *
        (window.innerHeight - 2 * EdgePadding - buttonRect.height);
      // Chooses a random position within the window dimensions,

      const newDistance = Math.sqrt(
        Math.pow(mouseX - newX, 2) + Math.pow(mouseY - newY, 2)
      );

      if (newDistance > MouseSneak * 9) {
        //Controls how fast the button runs away from the mouse.
        MuteBtn.style.transition = "all 0.3s ease-out";
        MuteBtn.style.left = `${newX}px`;
        MuteBtn.style.top = `${newY}px`;
        break;
      }
    }
  } else {
    if (RunningAudPlaying) {
      RunningAudio.pause();
      RunningAudPlaying = false;
      console.log("Stopped running audio.");
    }
  }
});

//#endregion
// #region AudioMute Logic
// 2. Handle the "Catch Me!" click event
MuteBtn.addEventListener("click", () => {
  isMuted = !isMuted; // Toggle the mute state

  if (localStream) {
    const UrOwnAudio = localStream.getAudioTracks();
    // Gets the audio that your computer is recording.

    UrOwnAudio.forEach((track) => {
      track.enabled = !track.enabled;
      console.log(`Yipppe! You've enabled your mic! ${track.enabled}`);
    });
    if (isMuted) {
      MuteIcon.setAttribute("src", "./CancelledShockedMike.png");
      MuteBtn.classList.add("muted");
    } else {
      MuteIcon.setAttribute(
        "src",
        "https://img.icons8.com/?size=100&id=6THNKcI0GcnT&format=png&color=3958B4"
      );
      MuteBtn.classList.remove("muted");
    }
  } else {
    console.warn("Local stream not available. Cannot toggle mute.");
  }

  if (RunningAudPlaying) {
    RunningAudio.pause();
    RunningAudPlaying = false;
    console.log("Stopped running audio.");
  }

  // setTimeout(() => {
  //   if (!IsMikeScreaming) {
  //     Scream.play();
  //     IsMikeScreaming = true;
  //   }
  // }, 100);

  if (!IsMikeScreaming) {
    Scream.play();
    IsMikeScreaming = true;
  }
});
// #endregion
// #endregion

// #region Cam on/off

// User clicks => Camera turns off => User Clicks again => Camera turns on => Pixelated Video streams.
// User Clicks => isPixelated false ==> User Clicks again ==> isPixalated true
function PixelateAnimation() {
  if (
    isPixelated &&
    localStream &&
    localStream.active &&
    localVideo.readyState >= localVideo.HAVE_CURRENT_DATA
  ) {
    ctx.drawImage(localVideo, 0, 0, cnv.width, cnv.height);
    PixelateWebcamVideo();

    requestAnimationFrame(PixelateAnimation);
  } else if (isPixelated) {
    requestAnimationFrame(PixelateAnimation);
  }
}

CameraBtn.addEventListener("click", () => {
  const videoTracks = localStream.getVideoTracks();

  if (!localStream) {
    console.warn("Local stream not available to toggle camera.");
    return;
  }

  if (videoTracks.length === 0) {
    console.warn("No video tracks found in local stream.");
    return;
  }

  const videoTrack = videoTracks[0];

  if (isCameraOn === true) {
    isCameraOn = false;
    // Turns off the camera.
  } else {
    isCameraOn = true;
  }

  if (!isCameraOn) {
    videoTrack.enabled = false;
    // Turns off the video track of the webcam.

    isPixelated = false;
    // const WebcamVid = videoTracks[0];
    // WebcamVid.enabled = false;

    CameraBtn.classList.add("off");
    CameraIcon.src = "./VideoCall-Hide.png";
    alert("🤨 What are you hiding?");
    if (YouSus) {
      YouSus.currentTime = 0;
      YouSus.play().catch((e) => console.warn("Sus audio not playing", e));
    }
  } else {
    videoTrack.enabled = true;
    // Turns on the camera.

    const setupCanvasForPixelation = () => {
      if (localVideo.videoWidth > 0 && localVideo.videoHeight > 0) {
        cnv.width = localVideo.videoWidth;
        cnv.height = localVideo.videoHeight;

        localVideo.style.display = "none";
        cnv.style.display = "block";
        isPixelated = true;
        PixelateAnimation();
      } else {
        console.warn(
          "Video Metadata not ready for canvas setup (width/height is 0). Retrying soon."
        );
      }
    };

    if (localVideo.readyState >= localVideo.HAVE_METADATA) {
      // HAVE_METADATA is 1
      setupCanvasForPixelation();
    } else {
      // Wait for metadata to load
      localVideo.addEventListener("loadedmetadata", setupCanvasForPixelation, {
        once: true,
      });
    }

    CameraBtn.classList.remove("off");
    CameraIcon.src =
      "https://img.icons8.com/?size=100&id=QccisbQJF3lB&format=png&color=3958B4";

    // localVideo.addEventListener("loadedmetadata", () => {
    //   cnv.width = localVideo.videoWidth;
    //   cnv.height = localVideo.videoHeight;
    // });

    // cnv.width = localVideo.videoWidth;
    // cnv.height = localVideo.videoHeight;

    // localVideo.onloadedmetadata = () => {
    //   cnv.width = localVideo.videoWidth;
    //   cnv.height = localVideo.videoHeight;
    //   localVideo.style.display = "none";
    //   cnv.style.display = "block";
    //   isPixelated = true;
    //   PixelateAnimation();
    // };

    // if (localVideo.readyState >= 2) {
    //   cnv.width = localVideo.videoWidth;
    //   cnv.height = localVideo.videoHeight;
    //   localVideo.style.display = "none";
    //   cnv.style.display = "block";
    //   isPixelated = true;
    //   PixelateAnimation();
    // }

    // localVideo.style.display = "none";
    // cnv.style.display = "block";
    // isPixelated = true;
    // PixelateAnimation();
  }
});

// #region Pixelate Video

// Function to pixelate the video:

function PixelateWebcamVideo() {
  if (cnv.width === 0 || cnv.height === 0) {
    console.warn("Canvas dimensions are zero, skipping pixelation.");
    return;
  }

  const VidImageData = ctx.getImageData(0, 0, cnv.width, cnv.height);
  const RawPixelData = VidImageData.data;
  const PixelatedVidData = new Uint8ClampedArray(RawPixelData.length); // Use a more descriptive name
  const PixelSize = 15; // Taste the Pixels!

  for (let y = 0; y < cnv.height; y += PixelSize) {
    for (let x = 0; x < cnv.width; x += PixelSize) {
      let r_sum = 0;
      let g_sum = 0;
      let b_sum = 0;
      let a_sum = 0;
      let count = 0;

      // Calculate the average color of the current block
      for (let dy = 0; dy < PixelSize && y + dy < cnv.height; dy++) {
        for (let dx = 0; dx < PixelSize && x + dx < cnv.width; dx++) {
          const index = ((y + dy) * cnv.width + (x + dx)) * 4;
          r_sum += RawPixelData[index];
          g_sum += RawPixelData[index + 1];
          b_sum += RawPixelData[index + 2];
          a_sum += RawPixelData[index + 3];
          count++;
        }
      }

      if (count > 0) {
        const r_avg = r_sum / count;
        const g_avg = g_sum / count;
        const b_avg = b_sum / count;
        const a_avg = a_sum / count; // Average alpha too, or use 255 for full opacity

        // Apply the average color to all pixels in the block
        for (let dy = 0; dy < PixelSize && y + dy < cnv.height; dy++) {
          for (let dx = 0; dx < PixelSize && x + dx < cnv.width; dx++) {
            const index = ((y + dy) * cnv.width + (x + dx)) * 4;
            PixelatedVidData[index] = r_avg;
            PixelatedVidData[index + 1] = g_avg;
            PixelatedVidData[index + 2] = b_avg;
            PixelatedVidData[index + 3] = a_avg;
          }
        }
      }
    }
  }
  const PixelatedImageData = new ImageData(
    PixelatedVidData,
    cnv.width,
    cnv.height
  );
  ctx.putImageData(PixelatedImageData, 0, 0);
}
// const WebcamVids = localStream.getVideoTracks();

// #endregion

// DOM Elements

// --- Fetch ICE Servers ---
async function fetchIceServers() {
  console.log("Fetching ICE servers from /api/ice-servers...");
  try {
    const response = await fetch("/api/ice-servers");
    if (!response.ok) {
      console.error(
        "Failed to fetch ICE servers from API:",
        response.status,
        await response.text()
      );
      console.log("Using default fallback ICE configuration.");
      return;
    }
    const servers = await response.json();
    if (servers && servers.length > 0) {
      iceConfiguration.iceServers = servers;
      console.log(
        "Successfully fetched and updated ICE configuration:",
        iceConfiguration.iceServers.map((s) => s.urls).join(", ")
      );
    } else {
      console.warn(
        "Fetched ICE servers list from API is empty, using default fallback."
      );
    }
  } catch (error) {
    console.error("Error fetching ICE servers from API:", error);
    console.log("Using default fallback ICE configuration due to error.");
  }
}

// #region Video Call & Chat Eventlistners
// --- Initialization and Event Listeners ---
startButton.addEventListener("click", startSession);
hangupButton.addEventListener("click", hangUp);
sendButton.addEventListener("click", sendMessage);
chatInput.addEventListener("keypress", (event) => {
  if (event.key === "Enter" && !sendButton.disabled) {
    sendMessage();
  }
});
// #endregion

async function startSession() {
  console.log("Attempting to start session...");
  startButton.disabled = true;
  hangupButton.disabled = false;

  try {
    await fetchIceServers();

    console.log("Requesting local stream...");
    localStream = await navigator.mediaDevices.getUserMedia({
      audio: true,
      video: true,
    });
    localVideo.srcObject = localStream;
    console.log("Received local stream.");

    // ---- Determine role FIRST ----
    const offerSignal = await getSignalMessage("offer");
    if (!offerSignal || !offerSignal.payload) {
      isInitiator = true;
      console.log("This client will be the initiator.");
    } else {
      isInitiator = false;
      console.log("This client will be the receiver.");
    }
    // ---- Role determined ----

    await createPeerConnection(); // Now isInitiator is correctly set before this runs

    // ---- Offer/Answer logic based on the now-set isInitiator flag ----
    if (isInitiator) {
      if (peerConnection) {
        // Ensure peerConnection is created
        console.log("Initiator: Creating offer...");
        const offerSdp = await peerConnection.createOffer();
        await peerConnection.setLocalDescription(offerSdp);
        console.log(
          "Initiator's Local SDP Offer (first 500 chars):",
          peerConnection.localDescription.sdp.substring(0, 500)
        );
        await sendSignalMessage("offer", offerSdp);
        console.log("Sent offer to signaling server.");
      }
    } else {
      // This client is the receiver
      if (peerConnection && offerSignal && offerSignal.payload) {
        // Ensure peerConnection and offerSignal are valid
        console.log(
          "Receiver: Processing existing offer from signaling server:",
          offerSignal.payload.type
        );
        await peerConnection.setRemoteDescription(
          new RTCSessionDescription(offerSignal.payload)
        );
        console.log(
          "Receiver's Remote SDP Offer (first 500 chars):",
          peerConnection.remoteDescription.sdp.substring(0, 500)
        );
        console.log("Set remote description from offer. Creating answer...");
        const answerSdp = await peerConnection.createAnswer();
        await peerConnection.setLocalDescription(answerSdp);
        await sendSignalMessage("answer", answerSdp);
        console.log("Sent answer to signaling server.");
        await clearSignalMessage("offer");
      } else {
        console.error(
          "Receiver: PeerConnection or Offer signal is missing/invalid. Cannot proceed."
        );
        hangUp();
        return;
      }
    }

    pollForSignalMessages();
  } catch (e) {
    console.error("Error starting WebRTC session:", e);
    alert("Could not start session: " + e.message);
    hangUp();
  }
}

function createPeerConnection() {
  peerConnection = new RTCPeerConnection(iceConfiguration);
  console.log(
    "Created RTCPeerConnection with configuration:",
    JSON.stringify(iceConfiguration)
  );

  peerConnection.onicecandidate = (event) => {
    if (event.candidate && event.candidate.candidate) {
      console.log(
        "Local ICE candidate gathered:",
        event.candidate.candidate.substring(0, 70) + "..."
      );
      const candidateKey = isInitiator
        ? "candidate_initiator" // Server stores this as "candidates_for_receiver"
        : "candidate_receiver"; // Server stores this as "candidates_for_initiator"
      sendSignalMessage(candidateKey, event.candidate);
    } else if (!event.candidate) {
      console.log(
        "All local ICE candidates gathered (end-of-candidates signal)."
      );
    } else {
      console.log(
        "Local ICE candidate gathered, but candidate string is empty. Not sending.",
        event.candidate
      );
    }
  };

  peerConnection.ontrack = (event) => {
    console.log("Remote track received:", event.track.kind);
    if (remoteVideo.srcObject !== event.streams[0]) {
      remoteVideo.srcObject = event.streams[0];
      remoteStream = event.streams[0];
      console.log("Remote stream added to video element.");
    }
  };

  peerConnection.oniceconnectionstatechange = () => {
    if (peerConnection) {
      console.log(
        "ICE connection state changed to:",
        peerConnection.iceConnectionState
      );
      if (peerConnection.iceConnectionState === "failed") {
        console.error(
          "ICE connection failed. Check STUN/TURN server and network."
        );
      }
      if (peerConnection.iceConnectionState === "connected") {
        console.log("ICE connection established successfully!");
      }
      if (
        peerConnection.iceConnectionState === "disconnected" ||
        peerConnection.iceConnectionState === "closed"
      ) {
        console.log("ICE connection disconnected or closed.");
      }
    }
  };

  peerConnection.onsignalingstatechange = () => {
    if (peerConnection) {
      console.log("Signaling state changed to:", peerConnection.signalingState);
    }
  };

  if (localStream) {
    localStream.getTracks().forEach((track) => {
      console.log("Adding local track to PeerConnection:", track.kind);
      peerConnection.addTrack(track, localStream);
    });
    console.log("Finished adding local stream tracks to PeerConnection.");
  }

  if (isInitiator) {
    console.log("Initiator creating data channel 'chat'.");
    // Explicitly create data channel before offer.
    // Options: { negotiated: false } is default for this setup (in-band).
    // { ordered: true, reliable: true } are also defaults for "chat"-like channels.
    dataChannel = peerConnection.createDataChannel("chat", {
      negotiated: false,
    });
    console.log(
      `Initiator created dataChannel, initial readyState: ${dataChannel.readyState}`
    );
    setupDataChannelEvents(dataChannel);
  } else {
    // Receiver sets up listener for when data channel is announced by initiator's offer
    peerConnection.ondatachannel = (event) => {
      console.log("Receiver received 'ondatachannel' event.");
      dataChannel = event.channel;
      console.log(
        `Receiver received dataChannel '${dataChannel.label}', initial readyState: ${dataChannel.readyState}`
      );
      setupDataChannelEvents(dataChannel);
    };
  }
}

function setupDataChannelEvents(channel) {
  console.log(
    `Setting up data channel event listeners for channel '${channel.label}', current readyState: ${channel.readyState}`
  );
  channel.onopen = () => {
    console.log(`Data channel '${channel.label}' is open.`);
    chatInput.disabled = false;
    sendButton.disabled = false;
    displayChatMessage("System", "Chat connected!");
  };
  channel.onclose = () => {
    console.log(`Data channel '${channel.label}' is closed.`);
    chatInput.disabled = true;
    sendButton.disabled = true;
    displayChatMessage("System", "Chat disconnected.");
  };
  channel.onmessage = (event) => {
    console.log(
      `Message received on data channel: ${event.data.substring(0, 50)}...`
    );
    try {
      const messageData = JSON.parse(event.data);
      // Always display received messages as "Remote"
      displayChatMessage("Remote", messageData.message);
    } catch (_e) {
      // Fallback for non-JSON messages, also label as Remote
      displayChatMessage("Remote (raw)", event.data);
    }
  };
  channel.onerror = (error) => {
    console.error(`Data channel '${channel.label}' ERROR:`, error);
  };
  // ADD THIS to see if it's already open when events are attached (less likely but possible)
  if (channel.readyState === "open") {
    console.warn(
      `Data channel '${channel.label}' was already open when event listeners were attached.`
    );
    // Manually trigger open state logic if so (though onopen should still fire)
    chatInput.disabled = false;
    sendButton.disabled = false;
    displayChatMessage("System", "Chat connected (already open)!");
  }

  channel.onmessage = (event) => {
    try {
      const messageData = JSON.parse(event.data);
      if (messageData.type === "username") {
        // Update remote username
        const RemoteName = document.querySelector("#UsernameRemote");
        RemoteName.textContent = messageData.username;
      } else {
        // Handle regular chat messages
        displayChatMessage("Remote", messageData.message);
      }
    } catch (_e) {
      displayChatMessage("Remote (raw)", event.data);
    }
  };

  channel.onopen = () => {
    console.log(`Data channel '${channel.label}' is open.`);
    chatInput.disabled = false;
    sendButton.disabled = false;
    displayChatMessage("System", "Chat connected!");
    // Send username when connection opens
    sendUsername();
  };
}

function sendMessage() {
  const messageText = chatInput.value;
  if (messageText && dataChannel && dataChannel.readyState === "open") {
    const messagePayload = {
      // sender: "Local", // Not strictly needed in the payload, receiver assumes it's remote
      message: messageText,
    };
    dataChannel.send(JSON.stringify(messagePayload));
    displayChatMessage("Local", messageText);
    chatInput.value = "";
  } else {
    console.warn(
      "Cannot send message. Data channel not open or message empty."
    );
  }
}

function displayChatMessage(sender, message) {
  const p = document.createElement("p");
  p.textContent = `[${sender}]: ${message}`;
  chatLog.appendChild(p);
  chatLog.scrollTop = chatLog.scrollHeight;
}

async function hangUp() {
  console.log("Hanging up session...");
  if (peerConnection) {
    peerConnection.close();
    peerConnection = null;
  }
  if (localStream) {
    localStream.getTracks().forEach((track) => track.stop());
  }
  localStream = null;

  if (remoteStream) {
    remoteStream.getTracks().forEach((track) => track.stop());
  }
  remoteStream = null;

  if (dataChannel) {
    dataChannel.close();
    dataChannel = null;
  }

  localVideo.srcObject = null;
  remoteVideo.srcObject = null;

  startButton.disabled = false;
  hangupButton.disabled = true;
  chatInput.disabled = true;
  sendButton.disabled = true;

  console.log(
    "Attempting to clear offer/answer signals from server for this room..."
  );
  await clearSignalMessage("offer"); // For offer
  await clearSignalMessage("answer"); // For answer
  // Note: Candidate clearing in hangUp is now less effective as specific keys are needed.
  // Individual candidates are cleared during polling. Aggressive cleanup here would require
  // fetching all candidate keys for the room and deleting them, or a specific server endpoint.
  console.log("Session terminated.");
  isInitiator = false;
}

async function sendSignalMessage(type, payload) {
  try {
    console.log(`Sending signal type: ${type} to /signal`);
    const response = await fetch(`/signal?room=${ROOM_ID}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: type, payload: payload }),
    });
    if (!response.ok) {
      console.error(
        `Failed to send signal message ${type}:`,
        response.status,
        await response.text()
      );
    }
  } catch (error) {
    console.error(`Error sending signal message ${type}:`, error);
  }
}

async function getSignalMessage(type, suppressLog = false) {
  // Added suppressLog for quieter polling when connected
  try {
    const response = await fetch(`/signal?room=${ROOM_ID}&type=${type}`);
    if (response.ok) {
      const data = await response.json();
      // For candidates, data will be an array. For offer/answer, an object or null.
      if (type.startsWith("candidate_")) {
        if (!suppressLog || (Array.isArray(data) && data.length > 0)) {
          // Log if not suppressed OR if data exists
          console.log(
            `Received ${data ? data.length : 0} ${type} signals from /signal.`
          );
        }
      } else {
        console.log(
          `Received signal for ${type} from /signal:`,
          data ? data.type : "null"
        );
      }
      return data;
    }
    if (response.status === 404) {
      // For candidates, an empty array is returned by server for "not found" (HTTP 200 with empty array),
      // so 404 is usually for offer/answer not found.
      if (!suppressLog) {
        console.log(`No signal message of type ${type} found on server (404).`);
      }
      return type.startsWith("candidate_") ? [] : null;
    }
    console.error(
      `Failed to get signal message ${type} from server:`,
      response.status,
      await response.text()
    );
    return type.startsWith("candidate_") ? [] : null; // Fallback to empty array for candidates on error
  } catch (error) {
    console.error(`Error fetching signal message ${type} from server:`, error);
    return type.startsWith("candidate_") ? [] : null; // Fallback to empty array for candidates on error
  }
}

async function pollForSignalMessages() {
  if (
    !peerConnection ||
    peerConnection.signalingState === "closed" ||
    hangupButton.disabled
  ) {
    return;
  }

  const isConnected =
    peerConnection.iceConnectionState === "connected" ||
    peerConnection.iceConnectionState === "completed";

  try {
    if (isInitiator) {
      // Initiator polls for answers and receiver's candidates
      // Initiator always polls for an answer if it hasn't set remote description
      if (!peerConnection.remoteDescription) {
        const answerSignal = await getSignalMessage("answer"); // Expects single object
        if (answerSignal && answerSignal.payload) {
          console.log("Initiator received answer:", answerSignal.payload.type);
          await peerConnection.setRemoteDescription(
            new RTCSessionDescription(answerSignal.payload)
          );
          await clearSignalMessage("answer"); // Clear by type
        }
      }

      // Poll for receiver's candidates if not yet connected OR if there might be stragglers
      if (
        !isConnected ||
        Array.isArray(await getSignalMessage("candidate_receiver", true))
      ) {
        // Pass true to suppress "0 received" log if connected
        const receiverCandidates = await getSignalMessage("candidate_receiver");
        if (
          Array.isArray(receiverCandidates) &&
          receiverCandidates.length > 0
        ) {
          console.log(
            `Initiator processing ${receiverCandidates.length} receiver candidates.`
          );
          for (const candidateEntry of receiverCandidates) {
            if (candidateEntry.payload && candidateEntry.payload.candidate) {
              console.log(
                "Initiator adding remote (receiver's) ICE candidate:",
                candidateEntry.payload.candidate.substring(0, 70) + "..."
              );
              await peerConnection.addIceCandidate(
                new RTCIceCandidate(candidateEntry.payload)
              );
              await clearSignalMessage(
                null,
                JSON.stringify(candidateEntry.key)
              );
            } else {
              console.warn(
                "Initiator received receiver's candidate signal, but payload or candidate string is empty. Skipping.",
                candidateEntry
              );
              if (candidateEntry.key)
                await clearSignalMessage(
                  null,
                  JSON.stringify(candidateEntry.key)
                );
            }
          }
        } else if (!isConnected && Array.isArray(receiverCandidates)) {
          // Only log "0 received" if not connected yet
          console.log("Initiator: No new receiver candidates found yet.");
        }
      }
    } else {
      // Receiver polls for initiator's candidates
      // Poll for initiator's candidates if not yet connected OR if there might be stragglers
      if (
        !isConnected ||
        Array.isArray(await getSignalMessage("candidate_initiator", true))
      ) {
        // Pass true to suppress "0 received" log
        const initiatorCandidates = await getSignalMessage(
          "candidate_initiator"
        );
        if (
          Array.isArray(initiatorCandidates) &&
          initiatorCandidates.length > 0
        ) {
          console.log(
            `Receiver processing ${initiatorCandidates.length} initiator candidates.`
          );
          for (const candidateEntry of initiatorCandidates) {
            if (candidateEntry.payload && candidateEntry.payload.candidate) {
              console.log(
                "Receiver adding remote (initiator's) ICE candidate:",
                candidateEntry.payload.candidate.substring(0, 70) + "..."
              );
              await peerConnection.addIceCandidate(
                new RTCIceCandidate(candidateEntry.payload)
              );
              await clearSignalMessage(
                null,
                JSON.stringify(candidateEntry.key)
              );
            } else {
              console.warn(
                "Receiver received initiator's candidate signal, but payload or candidate string is empty. Skipping.",
                candidateEntry
              );
              if (candidateEntry.key)
                await clearSignalMessage(
                  null,
                  JSON.stringify(candidateEntry.key)
                );
            }
          }
        } else if (!isConnected && Array.isArray(initiatorCandidates)) {
          // Only log "0 received" if not connected yet
          console.log("Receiver: No new initiator candidates found yet.");
        }
      }
    }
  } catch (error) {
    console.error("Error polling for signal messages:", error);
  }

  // Determine if polling should continue
  const stillNeedToPollOfferAnswer =
    isInitiator && !peerConnection.remoteDescription;
  const iceStillNegotiating = !isConnected;

  if (
    peerConnection &&
    peerConnection.signalingState !== "closed" &&
    !hangupButton.disabled
  ) {
    if (stillNeedToPollOfferAnswer || iceStillNegotiating) {
      setTimeout(pollForSignalMessages, 2000);
    } else {
      console.log(
        "Connection established and offer/answer exchange complete. Stopping frequent polling."
      );
      // Optionally, implement a much slower "cleanup" poll for any very late candidates, or stop entirely.
      // For now, we stop frequent polling once connected and offer/answer is done.
    }
  }
}

async function clearSignalMessage(type, candidateKeyString = null) {
  try {
    let url = `/signal?room=${ROOM_ID}`;
    if (candidateKeyString) {
      // Deleting a specific candidate by its full Deno KV key
      url += `&candidateKey=${encodeURIComponent(candidateKeyString)}`;
      console.log(
        `Requesting to clear specific candidate on server. Key: ${candidateKeyString}`
      );
    } else if (type) {
      // Deleting an offer or answer by type
      url += `&type=${type}`;
      console.log(`Requesting to clear signal type: ${type} on server.`);
    } else {
      console.warn(
        "clearSignalMessage called without type or candidateKeyString."
      );
      return;
    }

    const response = await fetch(url, { method: "DELETE" });
    if (!response.ok && response.status !== 404) {
      console.error(
        `Failed to clear signal message on server: ${
          type || candidateKeyString
        }`,
        response.status,
        await response.text()
      );
    } else {
      console.log(
        `Signal message ${
          type || candidateKeyString
        } cleared on server (or was not present).`
      );
    }
  } catch (error) {
    console.error(
      `Error clearing signal message ${type || candidateKeyString} on server:`,
      error
    );
  }
}

// Initial UI state
hangupButton.disabled = true;
chatInput.disabled = true;
sendButton.disabled = true;

console.log("Client script loaded. Ready for user to start session.");
