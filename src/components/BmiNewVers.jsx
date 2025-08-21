import React, { useEffect, useRef, useState } from "react";

const regionConfig = {
  distracted: { name: "distracted", x: 703, y: 671, width: 920, height: 650 },
  hurry: { name: "hurry", x: 82, y: 1125, width: 666, height: 720 },
  mindfully: { name: "mindfully", x: 852, y: 1534, width: 768, height: 700 },
};

const referenceImagePaths = {
  distracted: "/eating-habit/reference/i_eat_while_distracted.jpg",
  hurry: "/eating-habit/reference/i_eat_in_a_hurry.jpg",
  mindfully: "/eating-habit/reference/i_eat_mindfully.jpg",
};

const BMISelectionFull = () => {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const referenceMats = useRef({});
  const [phase, setPhase] = useState("initializing");
  const [qrId, setQrId] = useState(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setQrId(params.get("qrId") || "");

    const loadReferenceImages = async () => {
      for (const [key, url] of Object.entries(referenceImagePaths)) {
        const img = new Image();
        img.src = url;
        await new Promise((res) => (img.onload = res));
        const canvas = document.createElement("canvas");
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0);
        const mat = window.cv.matFromImageData(ctx.getImageData(0, 0, img.width, img.height));
        referenceMats.current[key] = mat;
      }
    };

    const startCamera = async () => {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ 
      video: { facingMode: "environment" } 
    });
    videoRef.current.srcObject = stream;
    await videoRef.current.play();
    console.log("Camera started successfully");
  } catch (error) {
    console.error("Camera access failed:", error);
    // Fallback to front camera if rear camera fails
    try {
      const frontStream = await navigator.mediaDevices.getUserMedia({ 
        video: true 
      });
      videoRef.current.srcObject = frontStream;
      await videoRef.current.play();
    } catch (fallbackError) {
      console.error("All camera access failed:", fallbackError);
      alert("Camera access denied or unavailable");
    }
  }
};


    const detectPosterOnce = () => {
      const detector = new window.AR.Detector();
      const canvas = canvasRef.current;
      const ctx = canvas.getContext("2d");

      const checkLoop = () => {
        if (!videoRef.current || videoRef.current.readyState !== 4) {
          requestAnimationFrame(checkLoop);
          return;
        }

        canvas.width = videoRef.current.videoWidth;
        canvas.height = videoRef.current.videoHeight;
        ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const markers = detector.detect(imageData);

        const ids = markers.map((m) => m.id);
        if ([2, 3, 6, 13].every((id) => ids.includes(id))) {
          setPhase("poster_confirmed");
        } else {
          requestAnimationFrame(checkLoop);
        }
      };
      checkLoop();
    };

    const detectDisturbanceInRegions = () => {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext("2d");

      const baseline = {};

      const buildBaseline = () => {
        ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
        const frame = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const mat = window.cv.matFromImageData(frame);
        for (const key in regionConfig) {
          const r = regionConfig[key];
          const roi = mat.roi(new window.cv.Rect(r.x, r.y, r.width, r.height));
          baseline[key] = roi.clone();
          roi.delete();
        }
        mat.delete();
      };

      const detectLoop = () => {
        if (!videoRef.current || videoRef.current.readyState !== 4) {
          requestAnimationFrame(detectLoop);
          return;
        }

        ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
        const frame = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const mat = window.cv.matFromImageData(frame);

        for (const key in regionConfig) {
          const r = regionConfig[key];
          const currentROI = mat.roi(new window.cv.Rect(r.x, r.y, r.width, r.height));
          const diff = new window.cv.Mat();
          window.cv.absdiff(currentROI, baseline[key], diff);
          const gray = new window.cv.Mat();
          window.cv.cvtColor(diff, gray, window.cv.COLOR_RGBA2GRAY);
          const nonZero = window.cv.countNonZero(gray);
          gray.delete();
          diff.delete();

          if (nonZero > 3000) {
            console.log(`Detected disturbance in: ${key}`);
            handleRegionCaptureAndMatch(currentROI, key);
            mat.delete();
            return;
          }
          currentROI.delete();
        }

        mat.delete();
        requestAnimationFrame(detectLoop);
      };

      buildBaseline();
      requestAnimationFrame(detectLoop);
    };

    const handleRegionCaptureAndMatch = (regionMat, regionKey) => {
      const orb = new window.cv.ORB();
      const kp1 = new window.cv.KeyPointVector();
      const des1 = new window.cv.Mat();
      orb.detectAndCompute(regionMat, new window.cv.Mat(), kp1, des1);

      const bf = new window.cv.BFMatcher();
      let bestMatch = null;
      let maxMatches = 0;

      for (const [key, refMat] of Object.entries(referenceMats.current)) {
        const kp2 = new window.cv.KeyPointVector();
        const des2 = new window.cv.Mat();
        orb.detectAndCompute(refMat, new window.cv.Mat(), kp2, des2);
        const matches = new window.cv.DMatchVector();
        bf.match(des1, des2, matches);

        if (matches.size() > maxMatches) {
          maxMatches = matches.size();
          bestMatch = key;
        }

        kp2.delete();
        des2.delete();
        matches.delete();
      }

      orb.delete();
      kp1.delete();
      des1.delete();
      regionMat.delete();

      if (bestMatch) {
        window.location.href = `/eating-habit/selection/result?qrId=${qrId}&region=${bestMatch}`;
      }
    };

    const runFlow = async () => {
      await loadReferenceImages();
      await startCamera();
      detectPosterOnce();
    };

    runFlow();
  }, []);

  useEffect(() => {
    if (phase === "poster_confirmed") {
      const canvas = canvasRef.current;
      canvas.width = videoRef.current.videoWidth;
      canvas.height = videoRef.current.videoHeight;
      setTimeout(() => {
        detectDisturbanceInRegions();
      }, 1000);
    }
  }, [phase]);

  return (
    <div className="fixed inset-0 flex flex-col items-center justify-center bg-[#f3e8d4] p-4">
      <h1 className="text-2xl font-bold text-[#046a81] mb-4">
        {phase === "poster_confirmed" ? "Point to a Region" : "Align Poster with Markers"}
      </h1>
      <div className="relative bg-black w-full max-w-md aspect-[3/4]">
        <video ref={videoRef} autoPlay muted playsInline className="absolute inset-0 w-full h-full object-cover" />
        <canvas ref={canvasRef} className="absolute inset-0" />
      </div>
    </div>
  );
};

export default BMISelectionFull;
