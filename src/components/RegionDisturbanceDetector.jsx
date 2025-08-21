import React, { useRef, useEffect, useState } from "react";
import * as THREE from "three";
import { MindARThree } from "mind-ar/dist/mindar-image-three.prod.js";

export default function ARPosterDisturbance() {
  const containerRef = useRef();
  const videoRef = useRef();
  const [status, setStatus] = useState("Initializing...");

  const referenceMatsRef = useRef([]); // Baseline Mats for each target
  const lastBboxRef = useRef([]);      // Last bbox for each target
  const baselineCapturedRef = useRef([]); // Boolean per target
  const planesRef = useRef([]);        // Plane for bbox projection
  const mindarThreeRef = useRef();

  const waitForCV = () => {
    return new Promise((resolve) => {
      const check = () => {
        if (window.cv && window.cv.Mat) resolve();
        else setTimeout(check, 50);
      };
      check();
    });
  };

  useEffect(() => {
    const init = async () => {
      setStatus("⏳ Waiting for OpenCV...");
      await waitForCV();
      setStatus("📷 Starting AR...");
      startAR();
    };
    init();
  }, []);

  const startAR = async () => {
    const mindarThree = new MindARThree({
      container: containerRef.current,
      imageTargetSrc: "targets.mind",
    });
    mindarThreeRef.current = mindarThree;

    const { renderer, scene, camera } = mindarThree;

    for (let i = 0; i < 3; i++) {
      baselineCapturedRef.current[i] = false;

      const anchor = mindarThree.addAnchor(i);

      // Invisible plane to get bbox
      const geometry = new THREE.PlaneGeometry(1, 1);
      const material = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0 });
      const plane = new THREE.Mesh(geometry, material);
      planesRef.current[i] = plane;
      anchor.group.add(plane);

      anchor.onTargetFound = () => {
        console.log(`Target ${i} found!`);
        setStatus(`Target ${i} Found`);

        if (!baselineCapturedRef.current[i]) {
          setTimeout(() => {
            const bbox = getProjectedBbox(planesRef.current[i], camera, videoRef.current);
            if (bbox) {
              lastBboxRef.current[i] = bbox;
              referenceMatsRef.current[i] = captureReference(bbox);
              baselineCapturedRef.current[i] = true;
              setStatus(`📸 Baseline Captured for Target ${i}`);
            }
          }, 800);
        }
      };

      anchor.onTargetLost = () => {
        console.log(`Target ${i} lost`);
        setStatus(`Target ${i} Lost`);
      };
    }

    await mindarThree.start();
    videoRef.current = mindarThree.video;

    renderer.setAnimationLoop(() => {
      renderer.render(scene, camera);

      for (let i = 0; i < 3; i++) {
        if (baselineCapturedRef.current[i] && lastBboxRef.current[i] && referenceMatsRef.current[i]) {
          const disturbed = detectDisturbance(
            videoRef.current,
            lastBboxRef.current[i],
            referenceMatsRef.current[i]
          );
          if (disturbed) {
            setStatus(`🚨 Disturbance in Target ${i}!`);
          } else {
            setStatus(`✅ No Disturbance in Target ${i}`);
          }
        }
      }
    });
  };

  const captureReference = (bbox) => {
    const cv = window.cv;
    const videoEl = videoRef.current;
    if (!videoEl) return null;

    const src = new cv.Mat(videoEl.videoHeight, videoEl.videoWidth, cv.CV_8UC4);
    const cap = new cv.VideoCapture(videoEl);
    cap.read(src);

    const scaleX = videoEl.videoWidth / videoEl.clientWidth;
    const scaleY = videoEl.videoHeight / videoEl.clientHeight;

    const x = Math.floor(bbox.x * scaleX);
    const y = Math.floor(bbox.y * scaleY);
    const width = Math.floor(bbox.width * scaleX);
    const height = Math.floor(bbox.height * scaleY);

    const roi = src.roi(new cv.Rect(x, y, width, height));
    const clone = roi.clone();

    src.delete();
    roi.delete();

    return clone;
  };

  const detectDisturbance = (videoEl, bbox, referenceMat) => {
    const cv = window.cv;
    const src = new cv.Mat(videoEl.videoHeight, videoEl.videoWidth, cv.CV_8UC4);
    const cap = new cv.VideoCapture(videoEl);
    cap.read(src);

    const scaleX = videoEl.videoWidth / videoEl.clientWidth;
    const scaleY = videoEl.videoHeight / videoEl.clientHeight;

    const x = Math.floor(bbox.x * scaleX);
    const y = Math.floor(bbox.y * scaleY);
    const width = Math.floor(bbox.width * scaleX);
    const height = Math.floor(bbox.height * scaleY);

    if (width <= 0 || height <= 0) {
      src.delete();
      return false;
    }

    const roi = src.roi(new cv.Rect(x, y, width, height));
    const roiRef = referenceMat.roi(new cv.Rect(0, 0, width, height));

    const gray = new cv.Mat();
    const grayRef = new cv.Mat();
    cv.cvtColor(roi, gray, cv.COLOR_RGBA2GRAY, 0);
    cv.cvtColor(roiRef, grayRef, cv.COLOR_RGBA2GRAY, 0);

    const diff = new cv.Mat();
    cv.absdiff(gray, grayRef, diff);
    cv.threshold(diff, diff, 30, 255, cv.THRESH_BINARY);

    const nonZero = cv.countNonZero(diff);

    src.delete();
    roi.delete();
    roiRef.delete();
    gray.delete();
    grayRef.delete();
    diff.delete();

    return nonZero > 500; // adjust sensitivity
  };

  const getProjectedBbox = (plane, camera, videoEl) => {
    if (!plane) return null;

    const vertices = [
      new THREE.Vector3(-0.5, -0.5, 0),
      new THREE.Vector3(0.5, -0.5, 0),
      new THREE.Vector3(0.5, 0.5, 0),
      new THREE.Vector3(-0.5, 0.5, 0),
    ];

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

    vertices.forEach(v => {
      const worldPos = v.clone().applyMatrix4(plane.matrixWorld);
      const projected = worldPos.project(camera);

      const x = (projected.x + 1) / 2 * videoEl.clientWidth;
      const y = (-projected.y + 1) / 2 * videoEl.clientHeight;

      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    });

    return {
      x: minX,
      y: minY,
      width: maxX - minX,
      height: maxY - minY
    };
  };

  return (
    <div>
      <div ref={containerRef} style={{ width: "100vw", height: "100vh" }}></div>
      <div style={{
        position: "absolute",
        top: 10,
        left: 10,
        background: "#000",
        color: "#fff",
        padding: 5
      }}>
        {status}
      </div>
    </div>
  );
}
