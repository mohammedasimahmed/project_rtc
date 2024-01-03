import React, { useEffect, useState, useRef } from "react";
import "./App.css";
import { io } from "socket.io-client";

const App = () => {
  const [socket, _] = useState(io("http://localhost:5000"));
  const pcRef = useRef(new RTCPeerConnection());
  const localStreamRef = useRef(null);
  const remoteStreamRef = useRef(null);
  const callerCandidatesRef = useRef([])
  const offerDescRef = useRef(null)

  useEffect(() => {
    const servers = {
      iceServers: [
        {
          urls: [
            "stun:stun1.l.google.com:19302",
            "stun:stun2.l.google.com:19302",
          ],
        },
      ],
      iceCandidatePoolSize: 10,
    };

    pcRef.current = new RTCPeerConnection(servers);

    socket.on("connect", () => {
      console.log("Connected to socket.io server");
    });
    socket.on("ice_candidate", ({ ice_candidate }) => {
      callerCandidatesRef.current.push(ice_candidate);
    });
    socket.on("offer", ( offer ) => {
      console.log("Got Offer from caller", offer);
      offerDescRef.current = offer;
    });
    socket.on("answer", ( ans ) => {
      console.log("Received answer from callee", ans);
      const ansDesc = new RTCSessionDescription(ans);
      pcRef.current.setRemoteDescription(ansDesc);
      document.getElementById("hangupBtn").disabled = false;
    });
  }, [socket]);

  async function startWebcam() {
    try {
      let localStream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: false,
      });
      localStreamRef.current = localStream;
      remoteStreamRef.current = new MediaStream();
      localStreamRef.current.getTracks().forEach((track) => {
        pcRef.current.addTrack(track, localStreamRef.current);
      });
      pcRef.current.ontrack = (event) => {
        event.streams[0].getTracks().forEach((track) => {
          remoteStreamRef.current.addTrack(track);
        });
      };
      document.getElementById("myVideo").srcObject = localStreamRef.current;
      document.getElementById("remoteVideo").srcObject = remoteStreamRef.current;
      document.getElementById("callBtn").disabled = false;
      document.getElementById("ansBtn").disabled = false;
      document.getElementById("webcamBtn").disabled = true;
    } catch (error) {
      console.error("Error starting webcam:", error);
    }
  }

  async function callingBtn() {
    try {
      // Disable the answer button
      document.getElementById("ansBtn").disabled = true;

      // Generate a random callId
      const callId = Math.floor(Math.random() * 100000 + 1);
      console.log(callId);

      // Set the callId in the input field
      document.getElementById("callInput").value = callId;

      // Emit the callId event to the server
      socket.emit("callId", callId);

      // Set up the onicecandidate event handler
      pcRef.current.onicecandidate = (event) => {
        if (event.candidate) {
          // console.log("event.candidate", event.candidate);
          // Emit the ice_candidate event to the server
          socket.emit("ice_candidate", {
            ice_candidate: event.candidate,
            type: "caller",
          });
        }
      };

      // Create and set local offer description
      const offerDesc = await pcRef.current.createOffer();
      await pcRef.current.setLocalDescription(offerDesc);

      // Send the offer to the server
      socket.emit("offer", { offer: offerDesc });

      console.log("offer", offerDesc);

      // Set up event listeners for answer and ice_candidate

      socket.on("ice_candidate", ({ ice_candidate }) => {
        console.log("Received ice candidate from callee", ice_candidate);
        const candidate = new RTCIceCandidate(ice_candidate);
        pcRef.current.addIceCandidate(candidate);
      });
    } catch (error) {
      console.error("Error in callingBtn:", error);
    }
  }

  async function answerButton() {
    try {
      document.getElementById("callBtn").disabled = false;
      const callId = document.getElementById("callInput").value;
      console.log("callerCandidates",callerCandidatesRef.current)

      console.log("offer",offerDescRef.current);

      pcRef.current.onicecandidate = (event) => {
        if (event.candidate) {
          socket.emit("ice_candidate", {
            ice_candidate: event.candidate,
            type: "callee",
          });
        }
      };

      await pcRef.current.setRemoteDescription(
        new RTCSessionDescription(offerDescRef.current)
      );

      const ansDesc = await pcRef.current.createAnswer();
      await pcRef.current.setLocalDescription(ansDesc);

      const answer = {
        type: ansDesc.type,
        sdp: ansDesc.sdp,
      };
      socket.emit("answer",  answer );
      console.log("Send Answer From Callee", answer);

      callerCandidatesRef.current.forEach((candidate) => {
        console.log("Adding caller ice candidates", candidate);
        const iceCandidate = new RTCIceCandidate(candidate);
        pcRef.current.addIceCandidate(iceCandidate);
      });

      socket.on("ice_candidate", ({ ice_candidate }) => {
        console.log("Received ice candidate from caller", ice_candidate);
        const candidate = new RTCIceCandidate(ice_candidate);
        pcRef.current.addIceCandidate(candidate);
      });

      document.getElementById("hangupBtn").disabled = false;
    } catch (error) {
      console.error("Error in answerButton:", error);
    }
  }

  return (
    <div>
      <h1 className="text-5xl text-center">Start Your Webcam</h1>
      <div className="flex">
        <video id="myVideo" autoPlay playsInline></video>
        <video id="remoteVideo" autoPlay playsInline></video>
      </div>
      <button id="webcamBtn" onClick={startWebcam}>
        Start Webcam
      </button>
      <h1 className="text-5xl text-center">Create a New Call</h1>
      <button id="callBtn" onClick={callingBtn}>
        Create Call (Offer)
      </button>
      <h1>Join a Call</h1>
      <p>Answer The Call From a different browser or device</p>
      <input type="text" id="callInput" />
      <button id="ansBtn" onClick={answerButton}>
        Answer
      </button>
      <h1>Hangup</h1>
      <button id="hangupBtn" disabled>
        Hangup
      </button>
    </div>
  );
};

export default App;
