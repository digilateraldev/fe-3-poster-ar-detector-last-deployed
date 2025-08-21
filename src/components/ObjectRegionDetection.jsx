import React, { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import * as ort from "onnxruntime-web";

const RegionObjectDetector = () => {
  const containerRef = useRef(null);
  const [currentRegion, setCurrentRegion] = useState(null);
  const [session, setSession] = useState(null);

  // 1️⃣ Load YOLOv8n model
  useEffect(() => {
    const loadModel = async () => {
      console.log("Loading YOLOv8n model...");
      const s = await ort.InferenceSession.create("/models/yolov8n.onnx");
      setSession(s);
      console.log("YOLOv8n loaded");
    };
    loadModel();
  }, []);

  // 2️⃣ Initialize MindAR + AR tracking
  useEffect(() => {
    if (!session) return; // wait for YOLO

    let mindarThree;
    let animationId;
    let clock;
    let timeSinceLastCheck = 0;
    const checkInterval = 0.5; // seconds

    const startAR = async () => {
      const { MindARThree } = await import(
        "https://cdn.jsdelivr.net/npm/mind-ar@1.2.5/dist/mindar-image-three.prod.js"
      );

      mindarThree = new MindARThree({
        container: containerRef.current,
        imageTargetSrc: "targets.mind", // your .mind file
      });

      const { renderer, scene, camera } = mindarThree;

      // Anchors for 3 regions
      const anchor0 = mindarThree.addAnchor(0);
      const anchor1 = mindarThree.addAnchor(1);
      const anchor2 = mindarThree.addAnchor(2);

      anchor0.onTargetFound = () => setCurrentRegion("distracted");
      anchor1.onTargetFound = () => setCurrentRegion("hurry");
      anchor2.onTargetFound = () => setCurrentRegion("mindfully");

      anchor0.onTargetLost = () => setCurrentRegion(null);
      anchor1.onTargetLost = () => setCurrentRegion(null);
      anchor2.onTargetLost = () => setCurrentRegion(null);

      // 3️⃣ YOLO object detection function
      async function detectObjects(videoEl) {
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        canvas.width = 640;
        canvas.height = 640;
        ctx.drawImage(videoEl, 0, 0, 640, 640);
        const imageData = ctx.getImageData(0, 0, 640, 640);

        // YOLO expects [1, 3, 640, 640] RGB float32 normalized
        const data = new Float32Array(3 * 640 * 640);
        for (let i = 0; i < 640 * 640; i++) {
          data[i] = imageData.data[i * 4] / 255.0; // R
          data[i + 640 * 640] = imageData.data[i * 4 + 1] / 255.0; // G
          data[i + 2 * 640 * 640] = imageData.data[i * 4 + 2] / 255.0; // B
        }

        const input = new ort.Tensor("float32", data, [1, 3, 640, 640]);
        const results = await session.run({ images: input });

        const output = results[Object.keys(results)[0]]; // first output tensor
        const numPreds = output.dims[1];
        const values = output.data;

        // Filter: any object with confidence > 0.5
        for (let i = 0; i < numPreds; i++) {
          const conf = values[i * output.dims[2] + 4]; // objectness score
          if (conf > 0.5) return true;
        }
        return false;
      }

      clock = new THREE.Clock();

      const renderLoop = async () => {
        const delta = clock.getDelta();
        timeSinceLastCheck += delta;

        if (currentRegion && timeSinceLastCheck >= checkInterval) {
          const hasObject = await detectObjects(mindarThree.video);
          if (hasObject) {
            console.log(`✅ Confirmed detection in: ${currentRegion}`);
          }
          timeSinceLastCheck = 0;
        }

        renderer.render(scene, camera);
        animationId = requestAnimationFrame(renderLoop);
      };

      await mindarThree.start(); // shows camera feed
      renderLoop();
    };

    startAR();

    return () => {
      if (animationId) cancelAnimationFrame(animationId);
      if (mindarThree) mindarThree.stop();
    };
  }, [session, currentRegion]);

  return (
    <div
      ref={containerRef}
      style={{ width: "100%", height: "100vh", background: "black" }}
    />
  );
};

export default RegionObjectDetector;
