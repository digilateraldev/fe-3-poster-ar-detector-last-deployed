// import React, { useEffect, useRef, useState } from "react";
// import ImageMatcher from "../components/ImageMatcher";

// function SimplePosterSelector() {
//   const videoRef = useRef(null);
//   const [croppedCanvas, setCroppedCanvas] = useState(null);
//   const [matchedRegion, setMatchedRegion] = useState(null);

//   // 👇 Setup webcam feed
//   useEffect(() => {
//     const startCamera = async () => {
//       let stream = null;
//       let constraints = { video: { facingMode: { exact: "environment" } } };

//       try {
//         stream = await navigator.mediaDevices.getUserMedia(constraints);
//       } catch (err) {
//         constraints.video.facingMode = { ideal: "environment" };
//         try {
//           stream = await navigator.mediaDevices.getUserMedia(constraints);
//         } catch (err2) {
//           stream = await navigator.mediaDevices.getUserMedia({ video: true });
//         }
//       }

//       if (videoRef.current) {
//         videoRef.current.srcObject = stream;
//       }

//       return new Promise((resolve) => {
//         videoRef.current.onloadedmetadata = () => {
//           resolve(videoRef.current);
//         };
//       });
//     };

//     startCamera();

//     return () => {
//       // Stop the stream when component unmounts
//       if (videoRef.current && videoRef.current.srcObject) {
//         videoRef.current.srcObject.getTracks().forEach((track) => track.stop());
//       }
//     };
//   }, []);

//   // Crop region and trigger match
//   const handleDetect = () => {
//     const video = videoRef.current;
//     if (!video) return;

//     const canvas = document.createElement("canvas");
//     const ctx = canvas.getContext("2d");

//     // 👇 Update crop area as needed
//     const cropX = 100;
//     const cropY = 100;
//     const cropW = 200;
//     const cropH = 200;

//     canvas.width = 224;
//     canvas.height = 224;

//     ctx.drawImage(video, cropX, cropY, cropW, cropH, 0, 0, 224, 224);
//     setCroppedCanvas(canvas);
//   };

//   return (
//     <div className="p-4 space-y-4">
//       <video
//         ref={videoRef}
//         autoPlay
//         playsInline
//         muted
//         width="640"
//         height="480"
//         style={{ border: "1px solid gray" }}
//       />

//       <button
//         onClick={handleDetect}
//         className="bg-blue-500 text-white px-4 py-2 rounded"
//       >
//         Detect Pointed Region
//       </button>

//       {croppedCanvas && (
//         <ImageMatcher
//           croppedCanvas={croppedCanvas}
//           onResult={(label) => {
//             console.log("✅ Visual match result:", label);
//             setMatchedRegion(label);
//           }}
//         />
//       )}

//       {matchedRegion && (
//         <div className="p-4 bg-green-100 text-green-800 rounded shadow">
//           Selected Region: <strong>{matchedRegion}</strong>
//         </div>
//       )}
//     </div>
//   );
// }

// export default SimplePosterSelector;


import React, { useEffect, useRef, useState } from "react";
import ImageMatcher from "../components/ImageMatcher";
import { Hands } from "@mediapipe/hands";
import { Camera } from "@mediapipe/camera_utils";
import * as cam from "@mediapipe/camera_utils";

function SimplePosterSelector() {
  const videoRef = useRef(null);
  const [croppedCanvas, setCroppedCanvas] = useState(null);
  const [matchedRegion, setMatchedRegion] = useState(null);
  const [handDetected, setHandDetected] = useState(false); // to avoid repeated triggers

  const handleDetect = () => {
    const video = videoRef.current;
    if (!video) return;

    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");

    const cropX = 100;
    const cropY = 100;
    const cropW = 200;
    const cropH = 200;

    canvas.width = 224;
    canvas.height = 224;

    ctx.drawImage(video, cropX, cropY, cropW, cropH, 0, 0, 224, 224);
    setCroppedCanvas(canvas);
  };

useEffect(() => {
  const hands = new Hands({
    locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`,
  });

  hands.setOptions({
    maxNumHands: 1,
    modelComplexity: 1,
    minDetectionConfidence: 0.7,
    minTrackingConfidence: 0.7,
  });

  hands.onResults((results) => {
    const hasHand = results.multiHandLandmarks && results.multiHandLandmarks.length > 0;
    if (hasHand && !handDetected) {
      console.log("✋ Hand detected");
      setHandDetected(true);
      handleDetect();
      setTimeout(() => setHandDetected(false), 2000);
    }
  });

  let stream = null;
  let animationId;

  const startCamera = async () => {
    const constraintsList = [
      { video: { facingMode: { exact: "environment" } } },
      { video: { facingMode: { ideal: "environment" } } },
      { video: true },
    ];

    for (let constraints of constraintsList) {
      try {
        stream = await navigator.mediaDevices.getUserMedia(constraints);
        break;
      } catch (err) {
        console.warn("Camera constraint failed:", err);
      }
    }

    if (!stream) {
      alert("Unable to access the camera");
      return;
    }

    const video = videoRef.current;
    video.srcObject = stream;

    await new Promise((resolve) => {
      video.onloadedmetadata = () => resolve();
    });

    video.play();

    const processFrame = async () => {
      await hands.send({ image: video });
      animationId = requestAnimationFrame(processFrame);
    };

    processFrame();
  };

  startCamera();

  return () => {
    if (animationId) cancelAnimationFrame(animationId);
    if (stream) stream.getTracks().forEach((track) => track.stop());
  };
}, [handDetected]);



  return (
    <div className="p-4 space-y-4">
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        width="640"
        height="480"
        style={{ border: "1px solid gray" }}
      />

      {/* Optional: Manual fallback button */}
      <button
        onClick={handleDetect}
        className="bg-blue-500 text-white px-4 py-2 rounded"
      >
        Detect Manually
      </button>

      {croppedCanvas && (
        <>
         <ImageMatcher
          croppedCanvas={croppedCanvas}
          onResult={(label) => {
            console.log("✅ Visual match result:", label);
            setMatchedRegion(label);
          }}
        />
         <div>
      <h3 className="font-semibold">Debug: Cropped Image</h3>
      <img src={croppedCanvas.toDataURL()} alt="cropped preview" />
    </div>
        </>
       
      )}

      {matchedRegion && (
        <div className="p-4 bg-green-100 text-green-800 rounded shadow">
          Selected Region: <strong>{matchedRegion}</strong>
        </div>
      )}
    </div>
  );
}

export default SimplePosterSelector;
