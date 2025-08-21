// //ui logs for coin radius
// import React, { useRef, useEffect, useState } from "react";
// import * as THREE from "three";
// import { MindARThree } from "mind-ar/dist/mindar-image-three.prod.js";

// export default function ARPosterSelector() {
//   const containerRef = useRef();
//   const [region, setRegion] = useState(null);
//   const [status, setStatus] = useState("Initializing...");
//   const [bbox, setBbox] = useState(null);
//   const [opencvReady, setOpenCVReady] = useState(false);
//   const [debugLogs, setDebugLogs] = useState([]);  // <-- New state for logs

//   useEffect(() => {
//     function onOpenCVReady() {
//       setOpenCVReady(true);
//     }

//     if (window.cv && window.cv.Mat) {
//       setOpenCVReady(true);
//     } else {
//       document.addEventListener("opencvReady", onOpenCVReady);
//     }
//     return () => {
//       document.removeEventListener("opencvReady", onOpenCVReady);
//     };
//   }, []);

//   // Modified detectCircleInRegion returns logs and found boolean
//   const detectCircleInRegion = (videoEl, bbox) => {
//     const cv = window.cv;
//     if (!videoEl || videoEl.readyState !== 4 || !opencvReady || !cv)
//       return { found: false, logs: ["Video or OpenCV not ready"] };

//     const logs = [];

//     const src = new cv.Mat(
//       videoEl.videoHeight,
//       videoEl.videoWidth,
//       cv.CV_8UC4
//     );
//     const cap = new cv.VideoCapture(videoEl);
//     cap.read(src);

//     const scaleX = videoEl.videoWidth / window.innerWidth;
//     const scaleY = videoEl.videoHeight / window.innerHeight;

//     const x = Math.max(0, Math.floor(bbox.x * scaleX));
//     const y = Math.max(0, Math.floor(bbox.y * scaleY));
//     const width = Math.min(Math.floor(bbox.width * scaleX), src.cols - x);
//     const height = Math.min(Math.floor(bbox.height * scaleY), src.rows - y);

//     if (width <= 0 || height <= 0) {
//       src.delete();
//       return { found: false, logs: ["Invalid ROI dimensions"] };
//     }

//     const roi = src.roi(new cv.Rect(x, y, width, height));

//     const gray = new cv.Mat();
//     cv.cvtColor(roi, gray, cv.COLOR_RGBA2GRAY, 0);
//     cv.medianBlur(gray, gray, 5);

//     const circles = new cv.Mat();
//     cv.HoughCircles(
//       gray,
//       circles,
//       cv.HOUGH_GRADIENT,
//       1,
//       gray.rows / 8,
//       150,
//       40,
//       15,
//       60
//     );

//     logs.push(`Circles detected: ${circles.cols}`);

//     let found = false;
//     for (let i = 0; i < circles.cols; ++i) {
//       const cx = circles.data32F[i * 3];
//       const cy = circles.data32F[i * 3 + 1];
//       const radius = circles.data32F[i * 3 + 2];
//       logs.push(
//         `Circle ${i}: center=(${cx.toFixed(
//           1
//         )},${cy.toFixed(1)}), radius=${radius.toFixed(1)}`
//       );
//       if (radius >= 15 && radius <= 60) {
//         found = true;
//       }
//     }

//     src.delete();
//     roi.delete();
//     gray.delete();
//     circles.delete();

//     return { found, logs };
//   };

//   useEffect(() => {
//     if (!opencvReady) return;

//     let mindarThree = null;
//     let started = false;
//     let currentAnchor = null;
//     let frameCount = 0;
//     let lastStatus = "";

//     const updateStatus = (text) => {
//       if (lastStatus !== text) {
//         setStatus(text);
//         lastStatus = text;
//       }
//     };

//     const startAR = async () => {
//       setStatus("Starting camera...");
//       mindarThree = new MindARThree({
//         container: containerRef.current,
//         imageTargetSrc: "targets.mind",
//       });

//       const { renderer, scene, camera } = mindarThree;
//       await mindarThree.start();
//       started = true;

//       const videoEl = mindarThree.video;
//       setStatus("Point camera at marker...");

//       const anchors = [
//         { idx: 0, name: "distracted" },
//         { idx: 1, name: "hurry" },
//         { idx: 2, name: "mindfully" },
//       ];

//       anchors.forEach(({ idx, name }) => {
//         const anchor = mindarThree.addAnchor(idx);
//         const plane = new THREE.Mesh(
//           new THREE.PlaneGeometry(1, 1),
//           new THREE.MeshBasicMaterial({ visible: false })
//         );
//         anchor.group.add(plane);

//         anchor.onTargetFound = () => {
//           currentAnchor = { anchor, name, plane };
//         };

//         anchor.onTargetLost = () => {
//           updateStatus("No region detected");
//           setRegion(null);
//           setBbox(null);
//           currentAnchor = null;
//           setDebugLogs([]);
//         };
//       });

//       renderer.setAnimationLoop(() => {
//         renderer.render(scene, camera);

//         if (currentAnchor) {
//           const halfW = window.innerWidth / 2;
//           const halfH = window.innerHeight / 2;

//           const vertices = [
//             new THREE.Vector3(-0.5, -0.5, 0),
//             new THREE.Vector3(0.5, -0.5, 0),
//             new THREE.Vector3(0.5, 0.5, 0),
//             new THREE.Vector3(-0.5, 0.5, 0),
//           ];

//           const screenPoints = vertices.map((v) => {
//             const clone = v.clone();
//             clone.applyMatrix4(currentAnchor.plane.matrixWorld);
//             clone.project(camera);
//             return {
//               x: clone.x * halfW + halfW,
//               y: -clone.y * halfH + halfH,
//             };
//           });

//           const minX = Math.min(...screenPoints.map((p) => p.x));
//           const minY = Math.min(...screenPoints.map((p) => p.y));
//           const maxX = Math.max(...screenPoints.map((p) => p.x));
//           const maxY = Math.max(...screenPoints.map((p) => p.y));

//           const box = {
//             x: minX,
//             y: minY,
//             width: maxX - minX,
//             height: maxY - minY,
//           };

//           setBbox(box);

//           frameCount++;
//           if (frameCount % 3 === 0) {
//             const { found, logs } = detectCircleInRegion(videoEl, box);
//             setDebugLogs(logs);  // Show logs on UI

//             if (found) {
//               setRegion(currentAnchor.name);
//               updateStatus(`✅ ${currentAnchor.name} + Coin detected`);
//             } else {
//               setRegion(null);
//               updateStatus(`⚠️ ${currentAnchor.name} detected, no coin`);
//             }
//           }
//         }
//       });
//     };

//     startAR();

//     return () => {
//       if (mindarThree && started) mindarThree.stop();
//     };
//   }, [opencvReady]);

//   return (
//     <div className="fixed inset-0 flex flex-col bg-black text-white p-2">
//       <div ref={containerRef} className="absolute inset-0" />

//       {bbox && (
//         <div
//           style={{
//             position: "absolute",
//             left: `${bbox.x}px`,
//             top: `${bbox.y}px`,
//             width: `${bbox.width}px`,
//             height: `${bbox.height}px`,
//             border: "3px solid lime",
//             boxSizing: "border-box",
//             pointerEvents: "none",
//           }}
//         />
//       )}

//       <div className="absolute bottom-0 left-0 right-0 bg-black/80 p-2 text-center text-xs max-h-40 overflow-auto font-mono">
//         <div>{status}</div>
//         <pre style={{ whiteSpace: "pre-wrap" }}>
//           {debugLogs.length > 0
//             ? debugLogs.join("\n")
//             : "No circle detection logs yet..."}
//         </pre>
//       </div>
//     </div>
//   );
// }

// // without ui logs coin
// import React, { useRef, useEffect, useState } from "react";
// import * as THREE from "three";
// import { MindARThree } from "mind-ar/dist/mindar-image-three.prod.js";
// // import cv from "@techstark/opencv-js";

// export default function ARPosterSelector() {
//   const containerRef = useRef();
//   const [region, setRegion] = useState(null);
//   const [status, setStatus] = useState("Initializing...");
//   const [bbox, setBbox] = useState(null);
//   const [opencvReady, setOpenCVReady] = useState(false);

// useEffect(() => {
//   function onOpenCVReady() {
//     console.log("OpenCV ready event fired");
//     setOpenCVReady(true);
//   }

//   if (window.cv && window.cv.Mat) {
//     console.log("OpenCV already ready on mount");
//     setOpenCVReady(true);
//   } else {
//     console.log("Waiting for opencvReady event");
//     document.addEventListener('opencvReady', onOpenCVReady);
//   }

//   return () => {
//     document.removeEventListener('opencvReady', onOpenCVReady);
//   };
// }, []);

// useEffect(() => {
//   if (!opencvReady) return;  // <-- early exit if OpenCV not ready yet

//   let mindarThree = null;
//   let started = false;
//   let currentAnchor = null;
//   let frameCount = 0;
//   let lastStatus = "";

//   const updateStatus = (text) => {
//     if (lastStatus !== text) {
//       setStatus(text);
//       lastStatus = text;
//     }
//   };

//   const startAR = async () => {
//     setStatus("Starting camera...");
//     mindarThree = new MindARThree({
//       container: containerRef.current,
//       imageTargetSrc: "targets.mind",
//     });

//     const { renderer, scene, camera } = mindarThree;
//     await mindarThree.start();
//     started = true;

//     const videoEl = mindarThree.video;
//     setStatus("Point camera at marker...");

//     const anchors = [
//       { idx: 0, name: "distracted" },
//       { idx: 1, name: "hurry" },
//       { idx: 2, name: "mindfully" },
//     ];

//     anchors.forEach(({ idx, name }) => {
//       const anchor = mindarThree.addAnchor(idx);
//       const plane = new THREE.Mesh(
//         new THREE.PlaneGeometry(1, 1),
//         new THREE.MeshBasicMaterial({ visible: false })
//       );
//       anchor.group.add(plane);

//       anchor.onTargetFound = () => {
//         currentAnchor = { anchor, name, plane };
//       };

//       anchor.onTargetLost = () => {
//         updateStatus("No region detected");
//         setRegion(null);
//         setBbox(null);
//         currentAnchor = null;
//       };
//     });

//     renderer.setAnimationLoop(() => {
//       renderer.render(scene, camera);

//       if (currentAnchor) {
//         const halfW = window.innerWidth / 2;
//         const halfH = window.innerHeight / 2;

//         const vertices = [
//           new THREE.Vector3(-0.5, -0.5, 0),
//           new THREE.Vector3(0.5, -0.5, 0),
//           new THREE.Vector3(0.5, 0.5, 0),
//           new THREE.Vector3(-0.5, 0.5, 0),
//         ];

//         const screenPoints = vertices.map((v) => {
//           const clone = v.clone();
//           clone.applyMatrix4(currentAnchor.plane.matrixWorld);
//           clone.project(camera);
//           return {
//             x: clone.x * halfW + halfW,
//             y: -clone.y * halfH + halfH,
//           };
//         });

//         const minX = Math.min(...screenPoints.map((p) => p.x));
//         const minY = Math.min(...screenPoints.map((p) => p.y));
//         const maxX = Math.max(...screenPoints.map((p) => p.x));
//         const maxY = Math.max(...screenPoints.map((p) => p.y));

//         const box = {
//           x: minX,
//           y: minY,
//           width: maxX - minX,
//           height: maxY - minY,
//         };

//         setBbox(box);

//         // This check is now redundant since opencvReady must be true to reach here
//         frameCount++;
//         if (frameCount % 3 === 0) {  // Run detection every 3 frames
//           const coinFound = detectCircleInRegion(videoEl, box);
//           if (coinFound) {
//             setRegion(currentAnchor.name);
//             updateStatus(`✅ ${currentAnchor.name} + Coin detected`);
//           } else {
//             setRegion(null);
//             updateStatus(`⚠️ ${currentAnchor.name} detected, no coin`);
//           }
//         }
//       }
//     });
//   };

//   startAR();

//   return () => {
//     if (mindarThree && started) mindarThree.stop();
//   };
// }, [opencvReady]);

// const detectCircleInRegion = (videoEl, bbox) => {
//   const cv = window.cv;
//   if (!videoEl || videoEl.readyState !== 4 || !opencvReady || !cv) return false;

//   // Capture current frame into src mat
//   const src = new cv.Mat(videoEl.videoHeight, videoEl.videoWidth, cv.CV_8UC4);
//   const cap = new cv.VideoCapture(videoEl);
//   cap.read(src);

//   // Calculate scaled ROI based on bbox and video size
//   const scaleX = videoEl.videoWidth / window.innerWidth;
//   const scaleY = videoEl.videoHeight / window.innerHeight;

//   const x = Math.max(0, Math.floor(bbox.x * scaleX));
//   const y = Math.max(0, Math.floor(bbox.y * scaleY));
//   const width = Math.min(Math.floor(bbox.width * scaleX), src.cols - x);
//   const height = Math.min(Math.floor(bbox.height * scaleY), src.rows - y);

//   if (width <= 0 || height <= 0) {
//     src.delete();
//     return false;
//   }

//   // ROI from source frame
//   const roi = src.roi(new cv.Rect(x, y, width, height));

//   // Convert to grayscale and smooth
//   const gray = new cv.Mat();
//   cv.cvtColor(roi, gray, cv.COLOR_RGBA2GRAY, 0);
//   cv.medianBlur(gray, gray, 5);

//   // Detect circles using HoughCircles with tuned parameters
//   const circles = new cv.Mat();
//   cv.HoughCircles(
//     gray,
//     circles,
//     cv.HOUGH_GRADIENT,
//     1,            // dp: accumulator resolution
//     gray.rows / 8, // min distance between circles
//     150,          // param1: higher Canny edge threshold
//     40,           // param2: accumulator threshold for circle centers
//     15,           // minRadius: minimum circle radius
//     60            // maxRadius: maximum circle radius
//   );

//   console.log(`Circles detected: ${circles.cols}`);

//   // Iterate circles and check radius for filtering
//   let found = false;
//   for (let i = 0; i < circles.cols; ++i) {
//     const x = circles.data32F[i * 3];
//     const y = circles.data32F[i * 3 + 1];
//     const radius = circles.data32F[i * 3 + 2];

//     console.log(`Circle ${i}: center=(${x.toFixed(1)},${y.toFixed(1)}), radius=${radius.toFixed(1)}`);

//     if (radius >= 15 && radius <= 60) {
//       found = true;
//       break;  // Early exit if suitable circle found
//     }
//   }

//   // Clean up mats
//   src.delete();
//   roi.delete();
//   gray.delete();
//   circles.delete();

//   return found;
// };

//   useEffect(() => {
//     let mindarThree = null;
//     let started = false;
//     let currentAnchor = null;

//     const startAR = async () => {
//       setStatus("Starting camera...");
//       mindarThree = new MindARThree({
//         container: containerRef.current,
//         imageTargetSrc: "targets.mind",
//       });

//       const { renderer, scene, camera } = mindarThree;
//       await mindarThree.start();
//       started = true;

//       const videoEl = mindarThree.video;
//       setStatus("Point camera at marker...");

//       const anchors = [
//         { idx: 0, name: "distracted" },
//         { idx: 1, name: "hurry" },
//         { idx: 2, name: "mindfully" },
//       ];

//       anchors.forEach(({ idx, name }) => {
//         const anchor = mindarThree.addAnchor(idx);
//         const plane = new THREE.Mesh(
//           new THREE.PlaneGeometry(1, 1),
//           new THREE.MeshBasicMaterial({ visible: false })
//         );
//         anchor.group.add(plane);

//         anchor.onTargetFound = () => {
//           currentAnchor = { anchor, name, plane };
//         };

//         anchor.onTargetLost = () => {
//           setStatus("No region detected");
//           setRegion(null);
//           setBbox(null);
//           currentAnchor = null;
//         };
//       });

//       renderer.setAnimationLoop(() => {
//         renderer.render(scene, camera);

//         if (currentAnchor) {
//           // Compute bounding box
//           const halfW = window.innerWidth / 2;
//           const halfH = window.innerHeight / 2;

//           const vertices = [
//             new THREE.Vector3(-0.5, -0.5, 0),
//             new THREE.Vector3(0.5, -0.5, 0),
//             new THREE.Vector3(0.5, 0.5, 0),
//             new THREE.Vector3(-0.5, 0.5, 0),
//           ];

//           const screenPoints = vertices.map((v) => {
//             const clone = v.clone();
//             clone.applyMatrix4(currentAnchor.plane.matrixWorld);
//             clone.project(camera);
//             return {
//               x: clone.x * halfW + halfW,
//               y: -clone.y * halfH + halfH,
//             };
//           });

//           const minX = Math.min(...screenPoints.map((p) => p.x));
//           const minY = Math.min(...screenPoints.map((p) => p.y));
//           const maxX = Math.max(...screenPoints.map((p) => p.x));
//           const maxY = Math.max(...screenPoints.map((p) => p.y));

//           const box = {
//             x: minX,
//             y: minY,
//             width: maxX - minX,
//             height: maxY - minY,
//           };

//           setBbox(box);

//           if (!opencvReady) {
//             setStatus(`Marker "${currentAnchor.name}" detected (waiting for OpenCV...)`);
//           } else {
//             if (detectCircleInRegion(videoEl, box)) {
//               setRegion(currentAnchor.name);
//               setStatus(`✅ ${currentAnchor.name} + Coin detected`);
//             } else {
//               setRegion(null);
//               setStatus(`⚠️ ${currentAnchor.name} detected, no coin`);
//             }
//           }
//         }
//       });
//     };

//     startAR();

//     return () => {
//       if (mindarThree && started) mindarThree.stop();
//     };
//   }, [opencvReady]);

//   return (
//     <div className="fixed inset-0 flex flex-col bg-black text-white">
//       <div ref={containerRef} className="absolute inset-0" />

//       {bbox && (
//         <div
//           style={{
//             position: "absolute",
//             left: `${bbox.x}px`,
//             top: `${bbox.y}px`,
//             width: `${bbox.width}px`,
//             height: `${bbox.height}px`,
//             border: "3px solid lime",
//             boxSizing: "border-box",
//             pointerEvents: "none",
//           }}
//         />
//       )}

//       <div className="absolute bottom-0 left-0 right-0 bg-black/60 p-4 text-center text-sm">
//         {status}
//       </div>
//     </div>
//   );
// }

// //ui better for coin without logs
// import React, { useRef, useEffect, useState } from "react";
// import * as THREE from "three";
// import { MindARThree } from "mind-ar/dist/mindar-image-three.prod.js";

// export default function ARPosterSelector() {
//   const containerRef = useRef();
//   const [region, setRegion] = useState(null);
//   const [status, setStatus] = useState("Initializing...");
//   const [bbox, setBbox] = useState(null);
//   const [opencvReady, setOpenCVReady] = useState(false);
//   const [isProcessing, setIsProcessing] = useState(false);
//   const [isInitializing, setIsInitializing] = useState(true);

//   useEffect(() => {
//     function onOpenCVReady() {
//       setOpenCVReady(true);
//     }

//     if (window.cv && window.cv.Mat) {
//       setOpenCVReady(true);
//     } else {
//       document.addEventListener("opencvReady", onOpenCVReady);
//     }

//     return () => {
//       document.removeEventListener("opencvReady", onOpenCVReady);
//     };
//   }, []);

//   useEffect(() => {
//     if (!opencvReady) return;

//     let mindarThree = null;
//     let started = false;
//     let currentAnchor = null;
//     let frameCount = 0;
//     let lastStatus = "";

//     const updateStatus = (text) => {
//       if (lastStatus !== text) {
//         setStatus(text);
//         lastStatus = text;
//       }
//     };

//     const startAR = async () => {
//       setIsInitializing(true);
//       setStatus("Starting camera...");
//       mindarThree = new MindARThree({
//         container: containerRef.current,
//         imageTargetSrc: "targets.mind",
//          uiLoading: "no",
//          uiScanning: "no",
//       });

//       const { renderer, scene, camera } = mindarThree;
//       await mindarThree.start();
//       started = true;
//       setIsInitializing(false);

//       const videoEl = mindarThree.video;
//       setStatus("Point camera at marker...");

//       const anchors = [
//         { idx: 0, name: "distracted" },
//         { idx: 1, name: "hurry" },
//         { idx: 2, name: "mindfully" },
//       ];

//       anchors.forEach(({ idx, name }) => {
//         const anchor = mindarThree.addAnchor(idx);
//         const plane = new THREE.Mesh(
//           new THREE.PlaneGeometry(1, 1),
//           new THREE.MeshBasicMaterial({ visible: false })
//         );
//         anchor.group.add(plane);

//         anchor.onTargetFound = () => {
//           currentAnchor = { anchor, name, plane };
//         };

//         anchor.onTargetLost = () => {
//           updateStatus("No region detected");
//           setRegion(null);
//           setBbox(null);
//           currentAnchor = null;
//         };
//       });

//       renderer.setAnimationLoop(() => {
//         renderer.render(scene, camera);

//         if (currentAnchor) {
//           const halfW = window.innerWidth / 2;
//           const halfH = window.innerHeight / 2;

//           const vertices = [
//             new THREE.Vector3(-0.5, -0.5, 0),
//             new THREE.Vector3(0.5, -0.5, 0),
//             new THREE.Vector3(0.5, 0.5, 0),
//             new THREE.Vector3(-0.5, 0.5, 0),
//           ];

//           const screenPoints = vertices.map((v) => {
//             const clone = v.clone();
//             clone.applyMatrix4(currentAnchor.plane.matrixWorld);
//             clone.project(camera);
//             return {
//               x: clone.x * halfW + halfW,
//               y: -clone.y * halfH + halfH,
//             };
//           });

//           const minX = Math.min(...screenPoints.map((p) => p.x));
//           const minY = Math.min(...screenPoints.map((p) => p.y));
//           const maxX = Math.max(...screenPoints.map((p) => p.x));
//           const maxY = Math.max(...screenPoints.map((p) => p.y));

//           const box = {
//             x: minX,
//             y: minY,
//             width: maxX - minX,
//             height: maxY - minY,
//           };

//           setBbox(box);

//           frameCount++;
//           if (frameCount % 3 === 0) {
//             setIsProcessing(true);
//             const coinFound = detectCircleInRegion(videoEl, box);
//             if (coinFound) {
//               setRegion(currentAnchor.name);
//               updateStatus(`✅ ${currentAnchor.name} + Coin detected`);
//             } else {
//               setRegion(null);
//               updateStatus(`⚠️ ${currentAnchor.name} detected, no coin`);
//             }
//             setIsProcessing(false);
//           }
//         }
//       });
//     };

//     startAR();

//     return () => {
//       if (mindarThree && started) mindarThree.stop();
//     };
//   }, [opencvReady]);

//   const detectCircleInRegion = (videoEl, bbox) => {
//     const cv = window.cv;
//     if (!videoEl || videoEl.readyState !== 4 || !opencvReady || !cv) return false;

//     const src = new cv.Mat(videoEl.videoHeight, videoEl.videoWidth, cv.CV_8UC4);
//     const cap = new cv.VideoCapture(videoEl);
//     cap.read(src);

//     const scaleX = videoEl.videoWidth / window.innerWidth;
//     const scaleY = videoEl.videoHeight / window.innerHeight;

//     const x = Math.max(0, Math.floor(bbox.x * scaleX));
//     const y = Math.max(0, Math.floor(bbox.y * scaleY));
//     const width = Math.min(Math.floor(bbox.width * scaleX), src.cols - x);
//     const height = Math.min(Math.floor(bbox.height * scaleY), src.rows - y);

//     if (width <= 0 || height <= 0) {
//       src.delete();
//       return false;
//     }

//     const roi = src.roi(new cv.Rect(x, y, width, height));

//     const gray = new cv.Mat();
//     cv.cvtColor(roi, gray, cv.COLOR_RGBA2GRAY, 0);
//     cv.medianBlur(gray, gray, 5);

//     const circles = new cv.Mat();
//     cv.HoughCircles(
//       gray,
//       circles,
//       cv.HOUGH_GRADIENT,
//       1,
//       gray.rows / 8,
//       150,
//       40,
//       10,
//       60
//     );

//     let found = false;
//     for (let i = 0; i < circles.cols; ++i) {
//       const radius = circles.data32F[i * 3 + 2];
//       if (radius >= 15 && radius <= 60) {
//         found = true;
//         break;
//       }
//     }

//     src.delete();
//     roi.delete();
//     gray.delete();
//     circles.delete();

//     return found;
//   };

//   return (
//     <div className="fixed inset-0 flex flex-col items-center justify-center p-4 bg-[#f3e8d4] h-[100dvh]">
//       <h1 className="text-2xl font-bold text-[#046a81] mb-4">AR Coin Detector</h1>

//       <div
//         className="relative bg-black overflow-hidden"
//         style={{
//           width: "100vw",
//           height: "calc(100vw * 2200 / 1517)",
//           maxHeight: "100vh",
//           maxWidth: "calc(100vh * 1517 / 2200)",
//         }}
//       >
//         {bbox && (
//           <div
//             style={{
//               position: "absolute",
//               left: `${bbox.x}px`,
//               top: `${bbox.y}px`,
//               width: `${bbox.width}px`,
//               height: `${bbox.height}px`,
//               border: "3px solid lime",
//               boxSizing: "border-box",
//               pointerEvents: "none",
//               zIndex: 20,
//             }}
//           />
//         )}
//         <div
//           ref={containerRef}
//           className="absolute inset-0 w-[110vw] h-full"
//           style={{ zIndex: 10, background: "transparent" }}
//         />
//         {isProcessing && (
//           <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-70 z-30">
//             <div className="text-white text-center">
//               <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
//               <p>Processing...</p>
//             </div>
//           </div>
//         )}
//       </div>

//       <div className="mt-4 w-full max-w-md">
//         {isInitializing ? (
//           <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 flex items-center gap-3">
//             <div className="w-3 h-3 bg-orange-500 rounded-full animate-pulse"></div>
//             <div>
//               <p className="text-orange-800 font-medium text-sm">Initializing...</p>
//               <p className="text-orange-600 text-xs">Loading AR components</p>
//             </div>
//           </div>
//         ) : region ? (
//           <div className="bg-green-50 border border-green-200 rounded-lg p-3 flex items-center gap-3">
//             <div className="w-3 h-3 bg-green-500 rounded-full"></div>
//             <div>
//               <p className="text-green-800 font-medium text-sm">Region Detected</p>
//               <p className="text-green-600 text-xs">
//                 You are pointing to <strong>{region}</strong> with a coin
//               </p>
//             </div>
//           </div>
//         ) : (
//           <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-center gap-3">
//             <div className="w-3 h-3 bg-red-500 rounded-full"></div>
//             <div>
//               <p className="text-red-800 font-medium text-sm">No Coin Detected</p>
//               <p className="text-red-600 text-xs">Point your camera at a marker with a coin</p>
//             </div>
//           </div>
//         )}
//       </div>
//     </div>
//   );
// }

// //trying for pen
// import React, { useRef, useEffect, useState } from "react";
// import * as THREE from "three";
// import { MindARThree } from "mind-ar/dist/mindar-image-three.prod.js";

// export default function ARPosterSelector() {
//   const containerRef = useRef();
//   const [region, setRegion] = useState(null);
//   const [status, setStatus] = useState("Initializing...");
//   const [bbox, setBbox] = useState(null);
//   const [opencvReady, setOpenCVReady] = useState(false);
//   const [isProcessing, setIsProcessing] = useState(false);
//   const [isInitializing, setIsInitializing] = useState(true);

//   useEffect(() => {
//     function onOpenCVReady() {
//       setOpenCVReady(true);
//     }

//     if (window.cv && window.cv.Mat) {
//       setOpenCVReady(true);
//     } else {
//       document.addEventListener("opencvReady", onOpenCVReady);
//     }

//     return () => {
//       document.removeEventListener("opencvReady", onOpenCVReady);
//     };
//   }, []);

//   useEffect(() => {
//     if (!opencvReady) return;

//     let mindarThree = null;
//     let started = false;
//     let currentAnchor = null;
//     let frameCount = 0;
//     let lastStatus = "";

//     const updateStatus = (text) => {
//       if (lastStatus !== text) {
//         setStatus(text);
//         lastStatus = text;
//       }
//     };

//     const startAR = async () => {
//       setIsInitializing(true);
//       setStatus("Starting camera...");
//       mindarThree = new MindARThree({
//         container: containerRef.current,
//         imageTargetSrc: "targets.mind",
//         uiLoading: "no",
//         uiScanning: "no",
//       });

//       const { renderer, scene, camera } = mindarThree;
//       await mindarThree.start();
//       started = true;
//       setIsInitializing(false);

//       const videoEl = mindarThree.video;
//       setStatus("Point camera at marker...");

//       const anchors = [
//         { idx: 0, name: "distracted" },
//         { idx: 1, name: "hurry" },
//         { idx: 2, name: "mindfully" },
//       ];

//       anchors.forEach(({ idx, name }) => {
//         const anchor = mindarThree.addAnchor(idx);
//         const plane = new THREE.Mesh(
//           new THREE.PlaneGeometry(1, 1),
//           new THREE.MeshBasicMaterial({ visible: false })
//         );
//         anchor.group.add(plane);

//         anchor.onTargetFound = () => {
//           currentAnchor = { anchor, name, plane };
//         };

//         anchor.onTargetLost = () => {
//           updateStatus("No region detected");
//           setRegion(null);
//           setBbox(null);
//           currentAnchor = null;
//         };
//       });

//       renderer.setAnimationLoop(() => {
//         renderer.render(scene, camera);

//         if (currentAnchor) {
//           const halfW = window.innerWidth / 2;
//           const halfH = window.innerHeight / 2;

//           const vertices = [
//             new THREE.Vector3(-0.5, -0.5, 0),
//             new THREE.Vector3(0.5, -0.5, 0),
//             new THREE.Vector3(0.5, 0.5, 0),
//             new THREE.Vector3(-0.5, 0.5, 0),
//           ];

//           const screenPoints = vertices.map((v) => {
//             const clone = v.clone();
//             clone.applyMatrix4(currentAnchor.plane.matrixWorld);
//             clone.project(camera);
//             return {
//               x: clone.x * halfW + halfW,
//               y: -clone.y * halfH + halfH,
//             };
//           });

//           const minX = Math.min(...screenPoints.map((p) => p.x));
//           const minY = Math.min(...screenPoints.map((p) => p.y));
//           const maxX = Math.max(...screenPoints.map((p) => p.x));
//           const maxY = Math.max(...screenPoints.map((p) => p.y));

//           const box = {
//             x: minX,
//             y: minY,
//             width: maxX - minX,
//             height: maxY - minY,
//           };

//           setBbox(box);

//           frameCount++;
//           if (frameCount % 3 === 0) {
//             setIsProcessing(true);
//             const cylinderFound = detectCylinderInRegion(videoEl, box);
//             if (cylinderFound) {
//               setRegion(currentAnchor.name);
//               updateStatus(`✅ ${currentAnchor.name} + Cylinder detected`);
//             } else {
//               setRegion(null);
//               updateStatus(`⚠️ ${currentAnchor.name} detected, no cylinder`);
//             }

//             setIsProcessing(false);
//           }
//         }
//       });
//     };

//     startAR();

//     return () => {
//       if (mindarThree && started) mindarThree.stop();
//     };
//   }, [opencvReady]);

//   const detectCylinderInRegion = (videoEl, bbox) => {
//     const cv = window.cv;
//     if (!videoEl || videoEl.readyState !== 4 || !opencvReady || !cv)
//       return false;

//     const src = new cv.Mat(videoEl.videoHeight, videoEl.videoWidth, cv.CV_8UC4);
//     const cap = new cv.VideoCapture(videoEl);
//     cap.read(src);

//     const scaleX = videoEl.videoWidth / window.innerWidth;
//     const scaleY = videoEl.videoHeight / window.innerHeight;

//     const x = Math.max(0, Math.floor(bbox.x * scaleX));
//     const y = Math.max(0, Math.floor(bbox.y * scaleY));
//     const width = Math.min(Math.floor(bbox.width * scaleX), src.cols - x);
//     const height = Math.min(Math.floor(bbox.height * scaleY), src.rows - y);

//     if (width <= 0 || height <= 0) {
//       src.delete();
//       return false;
//     }

//     const roi = src.roi(new cv.Rect(x, y, width, height));

//     let gray = new cv.Mat();
//     cv.cvtColor(roi, gray, cv.COLOR_RGBA2GRAY, 0);
//     cv.GaussianBlur(gray, gray, new cv.Size(5, 5), 0);

//     let edges = new cv.Mat();
//     cv.Canny(gray, edges, 50, 150);

//     let contours = new cv.MatVector();
//     let hierarchy = new cv.Mat();
//     cv.findContours(
//       edges,
//       contours,
//       hierarchy,
//       cv.RETR_EXTERNAL,
//       cv.CHAIN_APPROX_SIMPLE
//     );

//     let found = false;
//     for (let i = 0; i < contours.size(); i++) {
//       let cnt = contours.get(i);
//       let rect = cv.minAreaRect(cnt);
//       let { size } = rect;

//       // size.width and size.height, find longer and shorter side
//       let longer = Math.max(size.width, size.height);
//       let shorter = Math.min(size.width, size.height);

//       let area = cv.contourArea(cnt);
//       let boundingRect = cv.boundingRect(cnt);
//       let rectArea = boundingRect.width * boundingRect.height;
//       let solidity = rectArea > 0 ? area / rectArea : 0;

//       // stricter thresholds for better accuracy
//       if (
//         longer > 80 &&
//         shorter > 15 &&
//         longer / shorter > 5 &&
//         solidity > 0.8
//       ) {
//         found = true;
//         cnt.delete();
//         break;
//       }
//       cnt.delete();
//     }

//     src.delete();
//     roi.delete();
//     gray.delete();
//     edges.delete();
//     contours.delete();
//     hierarchy.delete();

//     return found;
//   };

//   return (
//     <div className="fixed inset-0 flex flex-col items-center justify-center p-4 bg-[#f3e8d4] h-[100dvh]">
//       <h1 className="text-2xl font-bold text-[#046a81] mb-4">
//         AR Coin Detector
//       </h1>

//       <div
//         className="relative bg-black overflow-hidden"
//         style={{
//           width: "100vw",
//           height: "calc(100vw * 2200 / 1517)",
//           maxHeight: "100vh",
//           maxWidth: "calc(100vh * 1517 / 2200)",
//         }}
//       >
//         {bbox && (
//           <div
//             style={{
//               position: "absolute",
//               left: `${bbox.x}px`,
//               top: `${bbox.y}px`,
//               width: `${bbox.width}px`,
//               height: `${bbox.height}px`,
//               border: "3px solid lime",
//               boxSizing: "border-box",
//               pointerEvents: "none",
//               zIndex: 20,
//             }}
//           />
//         )}
//         <div
//           ref={containerRef}
//           className="absolute inset-0 w-[110vw] h-full"
//           style={{ zIndex: 10, background: "transparent" }}
//         />
//         {isProcessing && (
//           <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-70 z-30">
//             <div className="text-white text-center">
//               <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
//               <p>Processing...</p>
//             </div>
//           </div>
//         )}
//       </div>

//       <div className="mt-4 w-full max-w-md">
//         {isInitializing ? (
//           <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 flex items-center gap-3">
//             <div className="w-3 h-3 bg-orange-500 rounded-full animate-pulse"></div>
//             <div>
//               <p className="text-orange-800 font-medium text-sm">
//                 Initializing...
//               </p>
//               <p className="text-orange-600 text-xs">Loading AR components</p>
//             </div>
//           </div>
//         ) : region ? (
//           <div className="bg-green-50 border border-green-200 rounded-lg p-3 flex items-center gap-3">
//             <div className="w-3 h-3 bg-green-500 rounded-full"></div>
//             <div>
//               <p className="text-green-800 font-medium text-sm">
//                 Region Detected
//               </p>
//               <p className="text-green-600 text-xs">
//                 You are pointing to <strong>{region}</strong> with a cylinder
//               </p>
//             </div>
//           </div>
//         ) : (
//           <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-center gap-3">
//             <div className="w-3 h-3 bg-red-500 rounded-full"></div>
//             <div>
//               <p className="text-red-800 font-medium text-sm">
//                 No Cylinder Detected
//               </p>
//               <p className="text-red-600 text-xs">
//                 Point your camera at a marker with a cylinder
//               </p>
//             </div>
//           </div>
//         )}
//       </div>
//     </div>
//   );
// }

// //trying for any object---didnt work
// import React, { useRef, useEffect, useState } from "react";
// import * as THREE from "three";
// import { MindARThree } from "mind-ar/dist/mindar-image-three.prod.js";

// export default function ARPosterSelector() {
//   const containerRef = useRef();
//   const [region, setRegion] = useState(null);
//   const [status, setStatus] = useState("Initializing...");
//   const [bbox, setBbox] = useState(null);
//   const [opencvReady, setOpenCVReady] = useState(false);
//   const [isProcessing, setIsProcessing] = useState(false);
//   const [isInitializing, setIsInitializing] = useState(true);

//   useEffect(() => {
//     function onOpenCVReady() {
//       setOpenCVReady(true);
//     }

//     if (window.cv && window.cv.Mat) {
//       setOpenCVReady(true);
//     } else {
//       document.addEventListener("opencvReady", onOpenCVReady);
//     }

//     return () => {
//       document.removeEventListener("opencvReady", onOpenCVReady);
//     };
//   }, []);

//   useEffect(() => {
//     if (!opencvReady) return;

//     let mindarThree = null;
//     let started = false;
//     let currentAnchor = null;
//     let frameCount = 0;
//     let lastStatus = "";

//     const updateStatus = (text) => {
//       if (lastStatus !== text) {
//         setStatus(text);
//         lastStatus = text;
//       }
//     };

//     const startAR = async () => {
//       setIsInitializing(true);
//       setStatus("Starting camera...");
//       mindarThree = new MindARThree({
//         container: containerRef.current,
//         imageTargetSrc: "targets.mind",
//          uiLoading: "no",
//          uiScanning: "no",
//       });

//       const { renderer, scene, camera } = mindarThree;
//       await mindarThree.start();
//       started = true;
//       setIsInitializing(false);

//       const videoEl = mindarThree.video;
//       setStatus("Point camera at marker...");

//       const anchors = [
//         { idx: 0, name: "distracted" },
//         { idx: 1, name: "hurry" },
//         { idx: 2, name: "mindfully" },
//       ];

//       anchors.forEach(({ idx, name }) => {
//         const anchor = mindarThree.addAnchor(idx);
//         const plane = new THREE.Mesh(
//           new THREE.PlaneGeometry(1, 1),
//           new THREE.MeshBasicMaterial({ visible: false })
//         );
//         anchor.group.add(plane);

//         anchor.onTargetFound = () => {
//           currentAnchor = { anchor, name, plane };
//         };

//         anchor.onTargetLost = () => {
//           updateStatus("No region detected");
//           setRegion(null);
//           setBbox(null);
//           currentAnchor = null;
//         };
//       });

//       renderer.setAnimationLoop(() => {
//         renderer.render(scene, camera);

//         if (currentAnchor) {
//           const halfW = window.innerWidth / 2;
//           const halfH = window.innerHeight / 2;

//           const vertices = [
//             new THREE.Vector3(-0.5, -0.5, 0),
//             new THREE.Vector3(0.5, -0.5, 0),
//             new THREE.Vector3(0.5, 0.5, 0),
//             new THREE.Vector3(-0.5, 0.5, 0),
//           ];

//           const screenPoints = vertices.map((v) => {
//             const clone = v.clone();
//             clone.applyMatrix4(currentAnchor.plane.matrixWorld);
//             clone.project(camera);
//             return {
//               x: clone.x * halfW + halfW,
//               y: -clone.y * halfH + halfH,
//             };
//           });

//           const minX = Math.min(...screenPoints.map((p) => p.x));
//           const minY = Math.min(...screenPoints.map((p) => p.y));
//           const maxX = Math.max(...screenPoints.map((p) => p.x));
//           const maxY = Math.max(...screenPoints.map((p) => p.y));

//           const box = {
//             x: minX,
//             y: minY,
//             width: maxX - minX,
//             height: maxY - minY,
//           };

//           setBbox(box);

//           frameCount++;
//           if (frameCount % 3 === 0) {
//             setIsProcessing(true);
//             const coinFound = detectCircleInRegion(videoEl, box);
//             if (coinFound) {
//               setRegion(currentAnchor.name);
//               updateStatus(`✅ ${currentAnchor.name} + Coin detected`);
//             } else {
//               setRegion(null);
//               updateStatus(`⚠️ ${currentAnchor.name} detected, no coin`);
//             }
//             setIsProcessing(false);
//           }
//         }
//       });
//     };

//     startAR();

//     return () => {
//       if (mindarThree && started) mindarThree.stop();
//     };
//   }, [opencvReady]);

//   const detectCircleInRegion = (videoEl, bbox) => {
//     const cv = window.cv;
//     if (!videoEl || videoEl.readyState !== 4 || !opencvReady || !cv) return false;

//     const src = new cv.Mat(videoEl.videoHeight, videoEl.videoWidth, cv.CV_8UC4);
//     const cap = new cv.VideoCapture(videoEl);
//     cap.read(src);

//     const scaleX = videoEl.videoWidth / window.innerWidth;
//     const scaleY = videoEl.videoHeight / window.innerHeight;

//     const x = Math.max(0, Math.floor(bbox.x * scaleX));
//     const y = Math.max(0, Math.floor(bbox.y * scaleY));
//     const width = Math.min(Math.floor(bbox.width * scaleX), src.cols - x);
//     const height = Math.min(Math.floor(bbox.height * scaleY), src.rows - y);

//     if (width <= 0 || height <= 0) {
//       src.delete();
//       return false;
//     }

//     const roi = src.roi(new cv.Rect(x, y, width, height));

//     const gray = new cv.Mat();
//     cv.cvtColor(roi, gray, cv.COLOR_RGBA2GRAY, 0);
//     cv.medianBlur(gray, gray, 5);

//     const circles = new cv.Mat();
//     cv.HoughCircles(
//       gray,
//       circles,
//       cv.HOUGH_GRADIENT,
//       1,
//       gray.rows / 8,
//       150,
//       40,
//       10,
//       60
//     );

//     let found = false;
//     for (let i = 0; i < circles.cols; ++i) {
//       const radius = circles.data32F[i * 3 + 2];
//       if (radius >= 15 && radius <= 60) {
//         found = true;
//         break;
//       }
//     }

//     src.delete();
//     roi.delete();
//     gray.delete();
//     circles.delete();

//     return found;
//   };

//   return (
//     <div className="fixed inset-0 flex flex-col items-center justify-center p-4 bg-[#f3e8d4] h-[100dvh]">
//       <h1 className="text-2xl font-bold text-[#046a81] mb-4">AR Coin Detector</h1>

//       <div
//         className="relative bg-black overflow-hidden"
//         style={{
//           width: "100vw",
//           height: "calc(100vw * 2200 / 1517)",
//           maxHeight: "100vh",
//           maxWidth: "calc(100vh * 1517 / 2200)",
//         }}
//       >
//         {bbox && (
//           <div
//             style={{
//               position: "absolute",
//               left: `${bbox.x}px`,
//               top: `${bbox.y}px`,
//               width: `${bbox.width}px`,
//               height: `${bbox.height}px`,
//               border: "3px solid lime",
//               boxSizing: "border-box",
//               pointerEvents: "none",
//               zIndex: 20,
//             }}
//           />
//         )}
//         <div
//           ref={containerRef}
//           className="absolute inset-0 w-[110vw] h-full"
//           style={{ zIndex: 10, background: "transparent" }}
//         />
//         {isProcessing && (
//           <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-70 z-30">
//             <div className="text-white text-center">
//               <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
//               <p>Processing...</p>
//             </div>
//           </div>
//         )}
//       </div>

//       <div className="mt-4 w-full max-w-md">
//         {isInitializing ? (
//           <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 flex items-center gap-3">
//             <div className="w-3 h-3 bg-orange-500 rounded-full animate-pulse"></div>
//             <div>
//               <p className="text-orange-800 font-medium text-sm">Initializing...</p>
//               <p className="text-orange-600 text-xs">Loading AR components</p>
//             </div>
//           </div>
//         ) : region ? (
//           <div className="bg-green-50 border border-green-200 rounded-lg p-3 flex items-center gap-3">
//             <div className="w-3 h-3 bg-green-500 rounded-full"></div>
//             <div>
//               <p className="text-green-800 font-medium text-sm">Region Detected</p>
//               <p className="text-green-600 text-xs">
//                 You are pointing to <strong>{region}</strong> with a coin
//               </p>
//             </div>
//           </div>
//         ) : (
//           <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-center gap-3">
//             <div className="w-3 h-3 bg-red-500 rounded-full"></div>
//             <div>
//               <p className="text-red-800 font-medium text-sm">No Coin Detected</p>
//               <p className="text-red-600 text-xs">Point your camera at a marker with a coin</p>
//             </div>
//           </div>
//         )}
//       </div>
//     </div>
//   );
// }

// //trying for all regions at once
// import React, { useRef, useEffect, useState } from "react";
// import * as THREE from "three";
// import { MindARThree } from "mind-ar/dist/mindar-image-three.prod.js";

// export default function ARPosterSelector() {
//   const containerRef = useRef();
//   const [isInitializing, setIsInitializing] = useState(true);
//   const [regions, setRegions] = useState([]);

//   useEffect(() => {
//     let mindarThree = null;
//     let started = false;

//     const startAR = async () => {
//       mindarThree = new MindARThree({
//         container: containerRef.current,
//         imageTargetSrc: "targets.mind",
//         maxTrack: 3,
//         uiScanning: "no",
//         uiLoading: "no"
//       });

//       const { renderer, scene, camera } = mindarThree;
//       await mindarThree.start();
//       started = true;
//       setIsInitializing(false);

//       const setupAnchor = (index, name) => {
//         const anchor = mindarThree.addAnchor(index);
//         anchor.onTargetFound = () => {
//           console.log(`${name} detected`);
//           setRegions((prev) =>
//             prev.includes(name) ? prev : [...prev, name]
//           );
//         };
//         anchor.onTargetLost = () => {
//           console.log(`${name} lost`);
//           setRegions((prev) => prev.filter((r) => r !== name));
//         };
//       };

//       setupAnchor(0, "distracted");
//       setupAnchor(1, "hurry");
//       setupAnchor(2, "mindfully");

//       renderer.setAnimationLoop(() => {
//         renderer.render(scene, camera);
//       });
//     };

//     startAR();

//     return () => {
//       if (mindarThree && started) mindarThree.stop();
//     };
//   }, []);

//   return (
//     <div className="fixed inset-0 flex flex-col items-center justify-center p-4 bg-[#f3e8d4] h-[100dvh]">
//       <h1 className="text-2xl font-bold text-[#046a81] mb-4">AR Coin Detector</h1>

//       <div
//         className="relative bg-black overflow-hidden"
//         style={{
//           width: "100vw",
//           height: "calc(100vw * 2200 / 1517)",
//           maxHeight: "100vh",
//           maxWidth: "calc(100vh * 1517 / 2200)"
//         }}
//       >
//         <div
//           ref={containerRef}
//           className="absolute inset-0 w-[110vw] h-full"
//           style={{ zIndex: 10, background: "transparent" }}
//         />
//       </div>

//       {isInitializing ? (
//         <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 mt-4">
//           <p className="text-orange-800 font-medium text-sm">Initializing...</p>
//           <p className="text-orange-600 text-xs">Loading AR components</p>
//         </div>
//       ) : regions.length > 0 ? (
//         <div className="bg-green-50 border border-green-200 rounded-lg p-3 mt-4">
//           <p className="text-green-800 font-medium text-sm">Regions Detected:</p>
//           <ul className="text-green-600 text-xs">
//             {regions.map((r) => (
//               <li key={r}>• {r}</li>
//             ))}
//           </ul>
//         </div>
//       ) : (
//         <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 mt-4">
//           <p className="text-orange-800 font-medium text-sm">No region detected</p>
//           <p className="text-orange-600 text-xs">
//             Point to one of the defined poster regions
//           </p>
//         </div>
//       )}
//     </div>
//   );
// }

// //Using ssim 1608 -CG - v1
// import React, { useRef, useEffect, useState } from "react";
// import * as THREE from "three";
// import { MindARThree } from "mind-ar/dist/mindar-image-three.prod.js";
// import { ssim } from "ssim.js";

// export default function ARPosterSelector() {
//   const containerRef = useRef();
//   const videoRef = useRef();
//   const [isInitializing, setIsInitializing] = useState(true);
//   const [regions, setRegions] = useState([]);
//   const [activeRegion, setActiveRegion] = useState(null);

//   // Define fixed rectangles for zones
//   const zoneRects = {
//     distracted: { x: 100, y: 200, width: 300, height: 200 },
//     hurry: { x: 450, y: 200, width: 300, height: 200 },
//     mindfully: { x: 800, y: 200, width: 300, height: 200 },
//   };

//   // Preload reference images
//   const referenceImages = useRef({
//     distracted: null,
//     hurry: null,
//     mindfully: null,
//   });

//   useEffect(() => {
//     const loadImages = async () => {
//       const loadImg = (src) =>
//         new Promise((resolve) => {
//           const img = new Image();
//           img.src = src;
//           img.onload = () => resolve(img);
//         });

//       referenceImages.current.distracted = await loadImg(
//         "/eating-habit/reference/cropped_distracted.png"
//       );
//       referenceImages.current.hurry = await loadImg(
//         "/eating-habit/reference/cropped_hurry.png"
//       );
//       referenceImages.current.mindfully = await loadImg(
//         "/eating-habit/reference/cropped_mindfully.png"
//       );
//       // referenceImages.current.distracted = await loadImg(
//       //   "/eating-habit/reference/i_eat_while_distracted.png"
//       // );
//       // referenceImages.current.hurry = await loadImg(
//       //   "/eating-habit/reference/i_eat_in a_hurry.png"
//       // );
//       // referenceImages.current.mindfully = await loadImg(
//       //   "/eating-habit/reference/i_eat_mindfully.png"
//       // );
//     };

//     loadImages();
//   }, []);

//   useEffect(() => {
//     let mindarThree = null;
//     let started = false;
//     const detectedZones = new Set();

//     const startAR = async () => {
//       mindarThree = new MindARThree({
//         container: containerRef.current,
//         imageTargetSrc: "targets.mind",
//         maxTrack: 3,
//         uiScanning: "no",
//         uiLoading: "no",
//       });

//       const { renderer, scene, camera } = mindarThree;
//       await mindarThree.start();
//       started = true;
//       setIsInitializing(false);

//       videoRef.current = renderer.domElement;

//       const setupAnchor = (index, name) => {
//         const anchor = mindarThree.addAnchor(index);
//         anchor.onTargetFound = () => {
//           detectedZones.add(name);
//           setRegions(Array.from(detectedZones));
//         };
//         anchor.onTargetLost = () => {
//           detectedZones.delete(name);
//           setRegions(Array.from(detectedZones));
//           if (activeRegion === name) setActiveRegion(null);
//         };
//       };

//       setupAnchor(0, "distracted");
//       setupAnchor(1, "hurry");
//       setupAnchor(2, "mindfully");

//       // Continuous animation loop
//       renderer.setAnimationLoop(async () => {
//         renderer.render(scene, camera);

//         // For each visible region, check SSIM
//         for (let zoneName of detectedZones) {
//           await compareRegionWithRef(zoneName);
//         }
//       });
//     };

//     startAR();

//     return () => {
//       if (mindarThree && started) mindarThree.stop();
//     };
//   }, []);

//   // Capture current renderer frame
//   const takeSnapshot = () => {
//     if (!videoRef.current) return null;
//     const canvas = document.createElement("canvas");
//     canvas.width = videoRef.current.videoWidth || videoRef.current.width;
//     canvas.height = videoRef.current.videoHeight || videoRef.current.height;
//     const ctx = canvas.getContext("2d");

//     const img = new Image();
//   img.src = videoRef.current.toDataURL();
//     ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
//     return canvas;
//   };

//   // Compare detected region with reference image using SSIM
//   const compareRegionWithRef = async (zoneName) => {
//     const snapshotCanvas = takeSnapshot();
//     if (!snapshotCanvas) return;

//     const refImage = referenceImages.current[zoneName];
//     if (!refImage) return;

//     const rect = zoneRects[zoneName];

//     // Resize snapshot region to match reference image dimensions
//     const zoneCanvas = document.createElement("canvas");
//     zoneCanvas.width = refImage.width;
//     zoneCanvas.height = refImage.height;
//     const ctx = zoneCanvas.getContext("2d");

//     ctx.drawImage(
//       snapshotCanvas,
//       rect.x,
//       rect.y,
//       rect.width,
//       rect.height, // source rectangle
//       0,
//       0,
//       refImage.width,
//       refImage.height // destination rectangle matches reference image
//     );

//     const zoneImageData = ctx.getImageData(
//       0,
//       0,
//       refImage.width,
//       refImage.height
//     );

//     // Convert reference image to ImageData
//     const refCanvas = document.createElement("canvas");
//     refCanvas.width = refImage.width;
//     refCanvas.height = refImage.height;
//     const refCtx = refCanvas.getContext("2d");
//     refCtx.drawImage(refImage, 0, 0, refImage.width, refImage.height);
//     const refImageData = refCtx.getImageData(
//       0,
//       0,
//       refImage.width,
//       refImage.height
//     );

//     try {
//       const { mssim } = await ssim(zoneImageData, refImageData, {
//         bitDepth: 8,
//       });
//       console.log(`${zoneName} SSIM:`, mssim);

//       // Low SSIM → object present
//       if (!activeRegion || mssim < 0.8) {
//         setActiveRegion(zoneName);
//       }
//     } catch (err) {
//       console.error("SSIM comparison error:", err);
//     }
//   };

// //   //visulas of comaprison
// //   const compareRegionWithRef = async (zoneName) => {
// //   const snapshotCanvas = takeSnapshot();
// //   if (!snapshotCanvas) return;

// //   const refImage = referenceImages.current[zoneName];
// //   if (!refImage) return;

// //   const rect = zoneRects[zoneName];

// //   // Extract the current region from snapshot
// //   const zoneCanvas = document.createElement("canvas");
// //   zoneCanvas.width = refImage.width;
// //   zoneCanvas.height = refImage.height;
// //   const ctx = zoneCanvas.getContext("2d");

// //   ctx.drawImage(
// //     snapshotCanvas,
// //     rect.x,
// //     rect.y,
// //     rect.width,
// //     rect.height,
// //     0,
// //     0,
// //     refImage.width,
// //     refImage.height
// //   );

// //   const zoneImageData = ctx.getImageData(0, 0, refImage.width, refImage.height);

// //   // Convert reference image to ImageData
// //   const refCanvas = document.createElement("canvas");
// //   refCanvas.width = refImage.width;
// //   refCanvas.height = refImage.height;
// //   const refCtx = refCanvas.getContext("2d");
// //   refCtx.drawImage(refImage, 0, 0, refImage.width, refImage.height);
// //   const refImageData = refCtx.getImageData(0, 0, refImage.width, refImage.height);

// //   // SSIM computation
// //   try {
// //     const { mssim, ssim_map } = await ssim(zoneImageData, refImageData, {
// //       bitDepth: 8,
// //     });
// //     console.log(`${zoneName} SSIM:`, mssim);

// //     // Show visual comparison
// //     showSSIMComparison(zoneName, zoneCanvas, refCanvas, ssim_map);

// //     if (!activeRegion || mssim < 0.8) {
// //       setActiveRegion(zoneName);
// //     }
// //   } catch (err) {
// //     console.error("SSIM comparison error:", err);
// //   }
// // };

// //visuals of comparison
// const showSSIMComparison = (zoneName, zoneCanvas, refCanvas, ssimMap) => {
//   let container = document.getElementById("ssim-visuals");
//   if (!container) {
//     container = document.createElement("div");
//     container.id = "ssim-visuals";
//     container.style.position = "fixed";
//     container.style.bottom = "10px";
//     container.style.left = "10px";
//     container.style.background = "#fff";
//     container.style.padding = "8px";
//     container.style.border = "1px solid #000";
//     container.style.zIndex = 9999;
//     document.body.appendChild(container);
//   }

//   container.innerHTML = ""; // Clear previous visuals

//   const title = document.createElement("p");
//   title.textContent = `SSIM Visual - ${zoneName}`;
//   title.style.fontSize = "12px";
//   title.style.margin = "2px 0";
//   container.appendChild(title);

//   const wrapper = document.createElement("div");
//   wrapper.style.display = "flex";
//   wrapper.style.gap = "4px";

//   // Captured zone
//   const zoneImg = document.createElement("canvas");
//   zoneImg.width = zoneCanvas.width / 2;
//   zoneImg.height = zoneCanvas.height / 2;
//   zoneImg.getContext("2d").drawImage(zoneCanvas, 0, 0, zoneImg.width, zoneImg.height);
//   wrapper.appendChild(zoneImg);

//   // Reference
//   const refImg = document.createElement("canvas");
//   refImg.width = refCanvas.width / 2;
//   refImg.height = refCanvas.height / 2;
//   refImg.getContext("2d").drawImage(refCanvas, 0, 0, refImg.width, refImg.height);
//   wrapper.appendChild(refImg);

//   // Optional: visualize SSIM map
//   if (ssimMap) {
//     const diffCanvas = document.createElement("canvas");
//     diffCanvas.width = ssimMap.width;
//     diffCanvas.height = ssimMap.height;
//     const diffCtx = diffCanvas.getContext("2d");
//     const imgData = diffCtx.createImageData(ssimMap.width, ssimMap.height);

//     for (let i = 0; i < ssimMap.data.length; i++) {
//       const v = ssimMap.data[i] * 255;
//       imgData.data[i * 4] = v;
//       imgData.data[i * 4 + 1] = v;
//       imgData.data[i * 4 + 2] = v;
//       imgData.data[i * 4 + 3] = 255;
//     }
//     diffCtx.putImageData(imgData, 0, 0);
//     wrapper.appendChild(diffCanvas);
//   }

//   container.appendChild(wrapper);
// };

//   return (
//     <div className="fixed inset-0 flex flex-col items-center justify-center p-4 bg-[#f3e8d4] h-[100dvh]">
//       <h1 className="text-2xl font-bold text-[#046a81] mb-4">
//         AR Poster Detector
//       </h1>

//       <div
//         className="relative bg-black overflow-hidden"
//         style={{
//           width: "100vw",
//           height: "calc(100vw * 2200 / 1517)",
//           maxHeight: "100vh",
//           maxWidth: "calc(100vh * 1517 / 2200)",
//         }}
//       >
//         <div
//           ref={containerRef}
//           className="absolute inset-0 w-[110vw] h-full"
//           style={{ zIndex: 10, background: "transparent" }}
//         />
//       </div>

//       {isInitializing ? (
//         <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 mt-4">
//           <p className="text-orange-800 font-medium text-sm">Initializing...</p>
//           <p className="text-orange-600 text-xs">Loading AR components</p>
//         </div>
//       ) : regions.length > 0 ? (
//         <div className="bg-green-50 border border-green-200 rounded-lg p-3 mt-4">
//           <p className="text-green-800 font-medium text-sm">
//             Regions Detected:
//           </p>
//           <ul className="text-green-600 text-xs">
//             {regions.map((r) => (
//               <li key={r}>• {r}</li>
//             ))}
//           </ul>
//           {activeRegion && (
//             <p className="mt-2 text-red-600 font-semibold text-sm">
//               Object detected in region: {activeRegion}
//             </p>
//           )}
//         </div>
//       ) : (
//         <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 mt-4">
//           <p className="text-orange-800 font-medium text-sm">
//             No region detected
//           </p>
//           <p className="text-orange-600 text-xs">
//             Point to one of the defined poster regions
//           </p>
//         </div>
//       )}
//     </div>
//   );
// }

// //Using ssim 1608 -CG - without defining zoneRects - not working
// import React, { useRef, useEffect, useState } from "react";
// import * as THREE from "three";
// import { MindARThree } from "mind-ar/dist/mindar-image-three.prod.js";
// import { ssim } from "ssim.js";

// export default function ARPosterSelector() {
//   const containerRef = useRef();
//   const videoRef = useRef();
//   const [isInitializing, setIsInitializing] = useState(true);
//   const [regions, setRegions] = useState([]);
//   const [activeRegion, setActiveRegion] = useState(null);

//   // // Define fixed rectangles for zones
//   // const zoneRects = {
//   //   distracted: { x: 100, y: 200, width: 300, height: 200 },
//   //   hurry: { x: 450, y: 200, width: 300, height: 200 },
//   //   mindfully: { x: 800, y: 200, width: 300, height: 200 },
//   // };

//   // Preload reference images
//   const referenceImages = useRef({
//     distracted: null,
//     hurry: null,
//     mindfully: null,
//   });

//   useEffect(() => {
//     const loadImages = async () => {
//       const loadImg = (src) =>
//         new Promise((resolve) => {
//           const img = new Image();
//           img.src = src;
//           img.onload = () => resolve(img);
//         });

//       referenceImages.current.distracted = await loadImg(
//         "/eating-habit/reference/cropped_distracted.png"
//       );
//       referenceImages.current.hurry = await loadImg(
//         "/eating-habit/reference/cropped_hurry.png"
//       );
//       referenceImages.current.mindfully = await loadImg(
//         "/eating-habit/reference/cropped_mindfully.png"
//       );
//       // referenceImages.current.distracted = await loadImg(
//       //   "/eating-habit/reference/i_eat_while_distracted.png"
//       // );
//       // referenceImages.current.hurry = await loadImg(
//       //   "/eating-habit/reference/i_eat_in a_hurry.png"
//       // );
//       // referenceImages.current.mindfully = await loadImg(
//       //   "/eating-habit/reference/i_eat_mindfully.png"
//       // );
//     };

//     loadImages();
//   }, []);

//   useEffect(() => {
//   let mindarThree = null;
//   let started = false;
//   const detectedZones = new Set();

//   const startAR = async () => {
//     mindarThree = new MindARThree({
//       container: containerRef.current,
//       imageTargetSrc: "targets.mind",
//       maxTrack: 3,
//       uiScanning: "no",
//       uiLoading: "no",
//     });

//     const { renderer, scene, camera } = mindarThree;
//     await mindarThree.start();
//     started = true;
//     setIsInitializing(false);

//     videoRef.current = renderer.domElement;

//     const setupAnchor = (index, name) => {
//       const anchor = mindarThree.addAnchor(index);

//       anchor.onTargetFound = () => {
//         detectedZones.add({ name, anchor });
//         setRegions(Array.from(detectedZones).map(z => z.name));
//       };

//       anchor.onTargetLost = () => {
//         detectedZones.forEach(z => {
//           if (z.name === name) detectedZones.delete(z);
//         });
//         setRegions(Array.from(detectedZones).map(z => z.name));
//         if (activeRegion === name) setActiveRegion(null);
//       };
//     };

//     setupAnchor(0, "distracted");
//     setupAnchor(1, "hurry");
//     setupAnchor(2, "mindfully");

//     // Animation loop
//     renderer.setAnimationLoop(async () => {
//       renderer.render(scene, camera);

//       if (detectedZones.size === 0) return;

//       let snapshotCanvas = takeSnapshot();
//       if (!snapshotCanvas) return;

//       let lowestSSIM = 1;
//       let detectedRegion = null;

//       for (let { name, anchor } of detectedZones) {
//         const mssim = await compareAnchorWithRef(snapshotCanvas, anchor, name);
//         if (mssim < lowestSSIM) {
//           lowestSSIM = mssim;
//           detectedRegion = name;
//         }
//       }

//       if (lowestSSIM < 0.8) {
//         setActiveRegion(detectedRegion);
//       } else {
//         setActiveRegion(null);
//       }
//     });
//   };

//   startAR();

//   return () => {
//     if (mindarThree && started) mindarThree.stop();
//   };
// }, []);

//   // // Capture current renderer frame
//   // const takeSnapshot = () => {
//   //   if (!videoRef.current) return null;
//   //   const canvas = document.createElement("canvas");
//   //   canvas.width = videoRef.current.videoWidth || videoRef.current.width;
//   //   canvas.height = videoRef.current.videoHeight || videoRef.current.height;
//   //   const ctx = canvas.getContext("2d");

//   //   const img = new Image();
//   // img.src = videoRef.current.toDataURL();
//   //   ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
//   //   return canvas;
//   // };

// // Capture current renderer frame accurately
// const takeSnapshot = () => {
//   if (!videoRef.current) return null;

//   // Create a canvas matching the renderer dimensions
//   const canvas = document.createElement("canvas");
//   canvas.width = videoRef.current.width;
//   canvas.height = videoRef.current.height;
//   const ctx = canvas.getContext("2d");

//   // Copy the WebGL canvas content directly
//   ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);

//   return canvas;
// };

// const compareAnchorWithRef = async (snapshotCanvas, anchor, zoneName) => {
//   const refImage = referenceImages.current[zoneName];
//   if (!refImage) return 1; // SSIM=1 if ref not loaded

//   // Get anchor bounding box in screen coordinates
//   const screenBox = anchor.group.getBoundingBox
//     ? anchor.group.getBoundingBox()
//     : { x: 0, y: 0, width: snapshotCanvas.width, height: snapshotCanvas.height };

//   const zoneCanvas = document.createElement("canvas");
//   zoneCanvas.width = refImage.width;
//   zoneCanvas.height = refImage.height;
//   const ctx = zoneCanvas.getContext("2d");

//   ctx.drawImage(
//     snapshotCanvas,
//     screenBox.x,
//     screenBox.y,
//     screenBox.width,
//     screenBox.height,
//     0,
//     0,
//     refImage.width,
//     refImage.height
//   );

//   const zoneImageData = ctx.getImageData(0, 0, refImage.width, refImage.height);

//   // Convert reference image to ImageData
//   const refCanvas = document.createElement("canvas");
//   refCanvas.width = refImage.width;
//   refCanvas.height = refImage.height;
//   const refCtx = refCanvas.getContext("2d");
//   refCtx.drawImage(refImage, 0, 0, refImage.width, refImage.height);
//   const refImageData = refCtx.getImageData(0, 0, refImage.width, refImage.height);

//   try {
//     const { mssim } = await ssim(zoneImageData, refImageData, { bitDepth: 5 });
//     return mssim;
//   } catch (err) {
//     console.error("SSIM comparison error:", err);
//     return 1;
//   }
// };

// //   //visulas of comaprison
// //   const compareRegionWithRef = async (zoneName) => {
// //   const snapshotCanvas = takeSnapshot();
// //   if (!snapshotCanvas) return;

// //   const refImage = referenceImages.current[zoneName];
// //   if (!refImage) return;

// //   const rect = zoneRects[zoneName];

// //   // Extract the current region from snapshot
// //   const zoneCanvas = document.createElement("canvas");
// //   zoneCanvas.width = refImage.width;
// //   zoneCanvas.height = refImage.height;
// //   const ctx = zoneCanvas.getContext("2d");

// //   ctx.drawImage(
// //     snapshotCanvas,
// //     rect.x,
// //     rect.y,
// //     rect.width,
// //     rect.height,
// //     0,
// //     0,
// //     refImage.width,
// //     refImage.height
// //   );

// //   const zoneImageData = ctx.getImageData(0, 0, refImage.width, refImage.height);

// //   // Convert reference image to ImageData
// //   const refCanvas = document.createElement("canvas");
// //   refCanvas.width = refImage.width;
// //   refCanvas.height = refImage.height;
// //   const refCtx = refCanvas.getContext("2d");
// //   refCtx.drawImage(refImage, 0, 0, refImage.width, refImage.height);
// //   const refImageData = refCtx.getImageData(0, 0, refImage.width, refImage.height);

// //   // SSIM computation
// //   try {
// //     const { mssim, ssim_map } = await ssim(zoneImageData, refImageData, {
// //       bitDepth: 8,
// //     });
// //     console.log(`${zoneName} SSIM:`, mssim);

// //     // Show visual comparison
// //     showSSIMComparison(zoneName, zoneCanvas, refCanvas, ssim_map);

// //     if (!activeRegion || mssim < 0.8) {
// //       setActiveRegion(zoneName);
// //     }
// //   } catch (err) {
// //     console.error("SSIM comparison error:", err);
// //   }
// // };

// //visuals of comparison
// const showSSIMComparison = (zoneName, zoneCanvas, refCanvas, ssimMap) => {
//   let container = document.getElementById("ssim-visuals");
//   if (!container) {
//     container = document.createElement("div");
//     container.id = "ssim-visuals";
//     container.style.position = "fixed";
//     container.style.bottom = "10px";
//     container.style.left = "10px";
//     container.style.background = "#fff";
//     container.style.padding = "8px";
//     container.style.border = "1px solid #000";
//     container.style.zIndex = 9999;
//     document.body.appendChild(container);
//   }

//   container.innerHTML = ""; // Clear previous visuals

//   const title = document.createElement("p");
//   title.textContent = `SSIM Visual - ${zoneName}`;
//   title.style.fontSize = "12px";
//   title.style.margin = "2px 0";
//   container.appendChild(title);

//   const wrapper = document.createElement("div");
//   wrapper.style.display = "flex";
//   wrapper.style.gap = "4px";

//   // Captured zone
//   const zoneImg = document.createElement("canvas");
//   zoneImg.width = zoneCanvas.width / 2;
//   zoneImg.height = zoneCanvas.height / 2;
//   zoneImg.getContext("2d").drawImage(zoneCanvas, 0, 0, zoneImg.width, zoneImg.height);
//   wrapper.appendChild(zoneImg);

//   // Reference
//   const refImg = document.createElement("canvas");
//   refImg.width = refCanvas.width / 2;
//   refImg.height = refCanvas.height / 2;
//   refImg.getContext("2d").drawImage(refCanvas, 0, 0, refImg.width, refImg.height);
//   wrapper.appendChild(refImg);

//   // Optional: visualize SSIM map
//   if (ssimMap) {
//     const diffCanvas = document.createElement("canvas");
//     diffCanvas.width = ssimMap.width;
//     diffCanvas.height = ssimMap.height;
//     const diffCtx = diffCanvas.getContext("2d");
//     const imgData = diffCtx.createImageData(ssimMap.width, ssimMap.height);

//     for (let i = 0; i < ssimMap.data.length; i++) {
//       const v = ssimMap.data[i] * 255;
//       imgData.data[i * 4] = v;
//       imgData.data[i * 4 + 1] = v;
//       imgData.data[i * 4 + 2] = v;
//       imgData.data[i * 4 + 3] = 255;
//     }
//     diffCtx.putImageData(imgData, 0, 0);
//     wrapper.appendChild(diffCanvas);
//   }

//   container.appendChild(wrapper);
// };

//   return (
//     <div className="fixed inset-0 flex flex-col items-center justify-center p-4 bg-[#f3e8d4] h-[100dvh]">
//       <h1 className="text-2xl font-bold text-[#046a81] mb-4">
//         AR Poster Detector
//       </h1>

//       <div
//         className="relative bg-black overflow-hidden"
//         style={{
//           width: "100vw",
//           height: "calc(100vw * 2200 / 1517)",
//           maxHeight: "100vh",
//           maxWidth: "calc(100vh * 1517 / 2200)",
//         }}
//       >
//         <div
//           ref={containerRef}
//           className="absolute inset-0 w-[110vw] h-full"
//           style={{ zIndex: 10, background: "transparent" }}
//         />
//       </div>

//       {isInitializing ? (
//         <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 mt-4">
//           <p className="text-orange-800 font-medium text-sm">Initializing...</p>
//           <p className="text-orange-600 text-xs">Loading AR components</p>
//         </div>
//       ) : regions.length > 0 ? (
//         <div className="bg-green-50 border border-green-200 rounded-lg p-3 mt-4">
//           <p className="text-green-800 font-medium text-sm">
//             Regions Detected:
//           </p>
//           <ul className="text-green-600 text-xs">
//             {regions.map((r) => (
//               <li key={r}>• {r}</li>
//             ))}
//           </ul>
//           {activeRegion && (
//             <p className="mt-2 text-red-600 font-semibold text-sm">
//               Object detected in region: {activeRegion}
//             </p>
//           )}
//         </div>
//       ) : (
//         <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 mt-4">
//           <p className="text-orange-800 font-medium text-sm">
//             No region detected
//           </p>
//           <p className="text-orange-600 text-xs">
//             Point to one of the defined poster regions
//           </p>
//         </div>
//       )}
//     </div>
//   );
// }

// //using ssim - ds - not accurate
// import React, { useRef, useEffect, useState } from "react";
// import * as THREE from "three";
// import { MindARThree } from "mind-ar/dist/mindar-image-three.prod.js";
// import { ssim } from "ssim.js";

// export default function ARPosterSelector() {
//   const containerRef = useRef();
//   const videoRef = useRef();
//   const [isInitializing, setIsInitializing] = useState(true);
//   const [regions, setRegions] = useState([]);
//   const [activeRegion, setActiveRegion] = useState(null);
//   const [similarityScores, setSimilarityScores] = useState({});
//   const [debugInfo, setDebugInfo] = useState("");

//   // Define fixed rectangles for zones
//   const zoneRects = {
//     distracted: { x: 100, y: 200, width: 300, height: 200 },
//     hurry: { x: 450, y: 200, width: 300, height: 200 },
//     mindfully: { x: 800, y: 200, width: 300, height: 200 },
//   };

//   // Preload reference images
//   const referenceImages = useRef({
//     distracted: null,
//     hurry: null,
//     mindfully: null,
//   });

//   // SSIM threshold for considering an object present
//   const SSIM_THRESHOLD = 0.85;

//   useEffect(() => {
//     const loadImages = async () => {
//       const loadImg = (src) =>
//         new Promise((resolve) => {
//           const img = new Image();
//           img.crossOrigin = "Anonymous";
//           img.src = src;
//           img.onload = () => {
//             console.log(`Loaded reference image: ${src}`);
//             resolve(img);
//           };
//           img.onerror = (e) => {
//             console.error(`Failed to load image: ${src}`, e);
//             resolve(null);
//           };
//         });

//       referenceImages.current.distracted = await loadImg(
//         "/eating-habit/reference/cropped_distracted.png"
//       );
//       referenceImages.current.hurry = await loadImg(
//         "/eating-habit/reference/cropped_hurry.png"
//       );
//       referenceImages.current.mindfully = await loadImg(
//         "/eating-habit/reference/cropped_mindfully.png"
//       );
//     };

//     loadImages();
//   }, []);

//   useEffect(() => {
//     let mindarThree = null;
//     let started = false;
//     const detectedZones = new Set();

//     const startAR = async () => {
//       try {
//         mindarThree = new MindARThree({
//           container: containerRef.current,
//           imageTargetSrc: "targets.mind",
//           maxTrack: 3,
//           uiScanning: "no",
//           uiLoading: "no",
//         });

//         const { renderer, scene, camera } = mindarThree;
//         await mindarThree.start();
//         started = true;
//         setIsInitializing(false);

//         videoRef.current = renderer.domElement;

//         const setupAnchor = (index, name) => {
//           const anchor = mindarThree.addAnchor(index);
//           anchor.onTargetFound = () => {
//             detectedZones.add(name);
//             setRegions(Array.from(detectedZones));
//             setSimilarityScores(prev => ({ ...prev, [name]: null }));
//           };
//           anchor.onTargetLost = () => {
//             detectedZones.delete(name);
//             setRegions(Array.from(detectedZones));
//             if (activeRegion === name) setActiveRegion(null);
//           };
//         };

//         setupAnchor(0, "distracted");
//         setupAnchor(1, "hurry");
//         setupAnchor(2, "mindfully");

//         let lastComparison = 0;
//         const COMPARISON_INTERVAL = 1000; // Slower interval for debugging

//         renderer.setAnimationLoop(() => {
//           renderer.render(scene, camera);

//           const now = Date.now();
//           if (now - lastComparison > COMPARISON_INTERVAL && detectedZones.size > 0) {
//             lastComparison = now;
//             compareAllRegions(detectedZones);
//           }
//         });
//       } catch (error) {
//         console.error("AR initialization failed:", error);
//         setIsInitializing(false);
//       }
//     };

//     const compareAllRegions = async (detectedZones) => {
//       const newScores = { ...similarityScores };
//       let lowestScore = 1;
//       let detectedRegion = null;
//       let debugText = "";

//       for (const zoneName of detectedZones) {
//         const score = await compareRegionWithRef(zoneName);
//         newScores[zoneName] = score;
//         debugText += `${zoneName}: ${score.toFixed(4)}\n`;

//         if (score < lowestScore) {
//           lowestScore = score;
//           detectedRegion = score < SSIM_THRESHOLD ? zoneName : null;
//         }
//       }

//       setSimilarityScores(newScores);
//       setDebugInfo(debugText);
//       if (detectedRegion !== activeRegion) {
//         setActiveRegion(detectedRegion);
//       }
//     };

//     startAR();

//     return () => {
//       if (mindarThree && started) mindarThree.stop();
//     };
//   }, []);

//   const takeSnapshot = () => {
//     if (!videoRef.current) {
//       console.error("No video element available");
//       return null;
//     }

//     const video = videoRef.current;
//     const canvas = document.createElement("canvas");
//     canvas.width = video.videoWidth || video.width;
//     canvas.height = video.videoHeight || video.height;
//     const ctx = canvas.getContext("2d");

//     try {
//       ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
//       console.log("Snapshot taken", canvas.width, canvas.height);
//       return canvas;
//     } catch (error) {
//       console.error("Error taking snapshot:", error);
//       return null;
//     }
//   };

//   const compareRegionWithRef = async (zoneName) => {
//     const snapshotCanvas = takeSnapshot();
//     if (!snapshotCanvas) {
//       console.error("No snapshot available");
//       return 1;
//     }

//     const refImage = referenceImages.current[zoneName];
//     if (!refImage) {
//       console.error(`No reference image for ${zoneName}`);
//       return 1;
//     }

//     const rect = zoneRects[zoneName];
//     console.log(`Comparing ${zoneName} at`, rect);

//     // Create canvas for the region
//     const regionCanvas = document.createElement("canvas");
//     regionCanvas.width = refImage.width;
//     regionCanvas.height = refImage.height;
//     const regionCtx = regionCanvas.getContext("2d");

//     try {
//       regionCtx.drawImage(
//         snapshotCanvas,
//         rect.x,
//         rect.y,
//         rect.width,
//         rect.height,
//         0,
//         0,
//         refImage.width,
//         refImage.height
//       );

//       // Debug: Save the captured region
//       const regionDataURL = regionCanvas.toDataURL();
//       console.log(`Captured ${zoneName} region:`, regionDataURL);

//       const regionImageData = regionCtx.getImageData(0, 0, refImage.width, refImage.height);

//       // Prepare reference image
//       const refCanvas = document.createElement("canvas");
//       refCanvas.width = refImage.width;
//       refCanvas.height = refImage.height;
//       const refCtx = refCanvas.getContext("2d");
//       refCtx.drawImage(refImage, 0, 0, refImage.width, refImage.height);

//       // Debug: Save the reference image
//       const refDataURL = refCanvas.toDataURL();
//       console.log(`Reference ${zoneName} image:`, refDataURL);

//       const refImageData = refCtx.getImageData(0, 0, refImage.width, refImage.height);

//       // Verify we have valid image data
//       if (!regionImageData.data.length || !refImageData.data.length) {
//         console.error("Empty image data");
//         return 1;
//       }

//       // Calculate SSIM
//       const { mssim } = ssim(regionImageData, refImageData, {
//         bitDepth: 8,
//         k1: 0.01,
//         k2: 0.03,
//         windowSize: 11,
//       });

//       console.log(`SSIM for ${zoneName}:`, mssim);
//       return mssim;
//     } catch (error) {
//       console.error(`Error comparing ${zoneName}:`, error);
//       return 1;
//     }
//   };

//   const formatScore = (score) => {
//     if (score === null || score === undefined) return "N/A";
//     return score.toFixed(2);
//   };

//   return (
//     <div className="fixed inset-0 flex flex-col items-center justify-center p-4 bg-[#f3e8d4] h-[100dvh]">
//       <h1 className="text-2xl font-bold text-[#046a81] mb-4">
//         AR Poster Detector
//       </h1>

//       <div
//         className="relative bg-black overflow-hidden"
//         style={{
//           width: "100vw",
//           height: "calc(100vw * 2200 / 1517)",
//           maxHeight: "100vh",
//           maxWidth: "calc(100vh * 1517 / 2200)",
//         }}
//       >
//         <div
//           ref={containerRef}
//           className="absolute inset-0 w-[110vw] h-full"
//           style={{ zIndex: 10, background: "transparent" }}
//         />
//       </div>

//       {isInitializing ? (
//         <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 mt-4">
//           <p className="text-orange-800 font-medium text-sm">Initializing...</p>
//           <p className="text-orange-600 text-xs">Loading AR components</p>
//         </div>
//       ) : regions.length > 0 ? (
//         <div className="bg-green-50 border border-green-200 rounded-lg p-3 mt-4">
//           <p className="text-green-800 font-medium text-sm">
//             Regions Detected:
//           </p>
//           <ul className="text-green-600 text-xs">
//             {regions.map((r) => (
//               <li key={r}>
//                 • {r} (Similarity: {formatScore(similarityScores[r])})
//               </li>
//             ))}
//           </ul>
//           {activeRegion && (
//             <p className="mt-2 text-red-600 font-semibold text-sm">
//               Object detected in: {activeRegion} (Similarity: {formatScore(similarityScores[activeRegion])})
//             </p>
//           )}
//         </div>
//       ) : (
//         <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 mt-4">
//           <p className="text-orange-800 font-medium text-sm">
//             No region detected
//           </p>
//           <p className="text-orange-600 text-xs">
//             Point to one of the defined poster regions
//           </p>
//         </div>
//       )}

//       {/* Debug information */}
//       <div className="fixed bottom-2 left-2 bg-white bg-opacity-80 p-2 text-xs">
//         <pre>{debugInfo}</pre>
//       </div>
//     </div>
//   );
// }

//1808 trying with roboflow fingertip2 model - worked
//https://universe.roboflow.com/school-m6gql/fingertip-2/model/1
//https://universe.roboflow.com/nhi-tz2cg/nail-bheyh/model/1
//new changes for delay handling
import { useEffect, useRef, useState } from "react";
import { MindARThree } from "mind-ar/dist/mindar-image-three.prod.js";
import * as THREE from "three";
import axios from "axios";

export default function ARPointer() {
  const containerRef = useRef(null);
  const startedRef = useRef(false);
  const [handDetected, setHandDetected] = useState(false);
  const [region, setRegion] = useState(null);
  const [pointingAtRegion, setPointingAtRegion] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);
  const [qrId, setQrId] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // Roboflow configuration
  // const ROBOFLOW_API_KEY = "aZMug7EMp53aBAcNAe9j";
  const ROBOFLOW_API_KEY = import.meta.env.VITE_ROBOFLOW_API_KEY;

  const ROBOFLOW_MODEL_ID = "nail-bheyh"; //nail-bheyh  fingertip-2
  const ROBOFLOW_VERSION = 1;
  const ROBOFLOW_ENDPOINT = `https://detect.roboflow.com/${ROBOFLOW_MODEL_ID}/${ROBOFLOW_VERSION}?api_key=${ROBOFLOW_API_KEY}`;

  const handleSubmit = async (detectedRegion) => {
    try {
      setIsProcessing(true);
      const urlParams = new URLSearchParams(window.location.search);
      const qrId = urlParams.get("qrId");

      if (!qrId || !detectedRegion) {
        alert(
          "Missing QR ID or Region.\n\nqrId: " +
            qrId +
            "\nregion: " +
            detectedRegion
        );
        return;
      }

      window.location.replace(
        `/eating-habit/selection/result?qrId=${qrId}&region=${detectedRegion}`
      );
    } catch (err) {
      let errorMessage = "Submission failed. Please try again.";
      if (err?.message) {
        errorMessage += `\n\nError: ${err.message}`;
      }
      alert(errorMessage);
    } finally {
      setIsProcessing(false);
    }
  };

  const detectFingertips = async (video) => {
    try {
      // Create canvas to capture frame
      const canvas = document.createElement("canvas");
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      // Convert to base64
      const imageData = canvas.toDataURL("image/jpeg").split(",")[1];

      // Send to Roboflow API
      const response = await axios.post(ROBOFLOW_ENDPOINT, imageData, {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
      });

      return response.data.predictions;
    } catch (error) {
      console.error("Fingertip detection error:", error);
      return [];
    }
  };

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    setQrId(urlParams.get("qrId"));

    let mindarThree, rafId;
    let anchors = [];

    const init = async () => {
      try {
        setIsInitializing(true);

        if (startedRef.current) return;
        startedRef.current = true;

        // Create video element
        const video = document.createElement("video");
        video.setAttribute("autoplay", "");
        video.setAttribute("muted", "");
        video.setAttribute("playsinline", "");
        video.style.display = "none";
        document.body.appendChild(video);

        // Get camera stream
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
          audio: false,
        });
        video.srcObject = stream;
        await video.play();

        // Init MindAR with proper sizing
        mindarThree = new MindARThree({
          container: containerRef.current,
          imageTargetSrc: "targets.mind",
          video,
          uiLoading: "no",
          uiScanning: "no",
        });

        const { renderer, scene, camera } = mindarThree;

        // Set renderer to fill container
        renderer.setPixelRatio(window.devicePixelRatio);
        renderer.setSize(
          containerRef.current.clientWidth,
          containerRef.current.clientHeight
        );

        // Create anchors for each target
        anchors = [
          mindarThree.addAnchor(0),
          mindarThree.addAnchor(1),
          mindarThree.addAnchor(2),
        ];

        // Store target positions
        const targetPositions = [
          new THREE.Vector3(),
          new THREE.Vector3(),
          new THREE.Vector3(),
        ];
        const targetSizes = [
          new THREE.Vector2(200, 200),
          new THREE.Vector2(200, 200),
          new THREE.Vector2(200, 200),
        ];

        // const processFrame = async () => {
        //   // Update target positions
        //   anchors.forEach((anchor, index) => {
        //     if (anchor.visible) {
        //       anchor.group.getWorldPosition(targetPositions[index]);
        //     }
        //   });

        //   // Detect fingertips
        //   const predictions = await detectFingertips(video);

        //   if (predictions.length > 0) {
        //     setHandDetected(true);

        //     let isPointingAtTarget = false;
        //     let currentRegion = null;

        //     // Check each fingertip prediction
        //     predictions.forEach(prediction => {
        //       const x = prediction.x;
        //       const y = prediction.y;

        //       // Check if pointing at any target
        //       anchors.forEach((anchor, index) => {
        //         if (anchor.visible) {
        //           const position = targetPositions[index];
        //           const size = targetSizes[index];

        //           const vector = position.clone().project(camera);
        //           vector.x = ((vector.x + 1) / 2) * video.videoWidth;
        //           vector.y = (-(vector.y - 1) / 2) * video.videoHeight;

        //           const regionBounds = {
        //             x: vector.x - size.x/2,
        //             y: vector.y - size.y/2,
        //             width: size.x,
        //             height: size.y,
        //           };

        //           const insideRegion =
        //             x >= regionBounds.x &&
        //             x <= regionBounds.x + regionBounds.width &&
        //             y >= regionBounds.y &&
        //             y <= regionBounds.y + regionBounds.height;

        //           if (insideRegion) {
        //             isPointingAtTarget = true;
        //             currentRegion = ["distracted", "hurry", "mindfully"][index];
        //           }
        //         }
        //       });
        //     });

        //     setPointingAtRegion(isPointingAtTarget);
        //     if (isPointingAtTarget) {
        //       setRegion(currentRegion);
        //       handleSubmit(currentRegion);
        //     } else {
        //       setRegion(null);
        //     }
        //   } else {
        //     setHandDetected(false);
        //     setPointingAtRegion(false);
        //     setRegion(null);
        //   }

        //   renderer.render(scene, camera);
        //   rafId = requestAnimationFrame(processFrame);
        // };

        
        const processFrame = async () => {
          // Update target positions
          anchors.forEach((anchor, index) => {
            if (anchor.visible) {
              anchor.group.getWorldPosition(targetPositions[index]);
            }
          });

          // Detect fingertips
          const predictions = await detectFingertips(video);

          if (predictions.length > 0) {
            setHandDetected(true);

            let isPointingAtTarget = false;
            let currentRegion = null;

            // Check each fingertip prediction
            predictions.forEach((prediction) => {
              const x = prediction.x;
              const y = prediction.y;

              anchors.forEach((anchor, index) => {
                if (anchor.visible) {
                  const position = targetPositions[index];
                  const size = targetSizes[index];

                  const vector = position.clone().project(camera);
                  vector.x = ((vector.x + 1) / 2) * video.videoWidth;
                  vector.y = (-(vector.y - 1) / 2) * video.videoHeight;

                  const regionBounds = {
                    x: vector.x - size.x / 2,
                    y: vector.y - size.y / 2,
                    width: size.x,
                    height: size.y,
                  };

                  const insideRegion =
                    x >= regionBounds.x &&
                    x <= regionBounds.x + regionBounds.width &&
                    y >= regionBounds.y &&
                    y <= regionBounds.y + regionBounds.height;

                  if (insideRegion) {
                    isPointingAtTarget = true;
                    currentRegion = ["distracted", "hurry", "mindfully"][index];
                  }
                }
              });
            });

            setPointingAtRegion(isPointingAtTarget);
            if (isPointingAtTarget && !isProcessing) {
              setRegion(currentRegion);
              handleSubmit(currentRegion);
            } else if (!isPointingAtTarget) {
              setRegion(null);
            }
          } else {
            setHandDetected(false);
            setPointingAtRegion(false);
            setRegion(null);
          }

          renderer.render(scene, camera);
          rafId = requestAnimationFrame(processFrame);
        };

        await mindarThree.start();
        processFrame();
        setIsInitializing(false);
      } catch (error) {
        console.error("Error initializing AR:", error);
        setIsInitializing(false);
      }
    };

    init();

    return () => {
      if (rafId) cancelAnimationFrame(rafId);
      if (mindarThree) mindarThree.stop();
      const videoElements = document.querySelectorAll("video");
      videoElements.forEach((video) => video.remove());
    };
  }, []);

  return (
    <div className="fixed inset-0 flex flex-col items-center justify-center p-4 bg-[#f3e8d4] h-[100dvh]">
      <h1 className="text-2xl font-bold text-[#046a81] mb-4">Scanner</h1>

      <div
        className="relative bg-black overflow-hidden"
        style={{
          width: "100vw",
          height: "calc(100vw * 2200 / 1517)",
          maxHeight: "100vh",
          maxWidth: "calc(100vh * 1517 / 2200)",
        }}
      >
        {isProcessing && (
          <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-70 z-20">
            <div className="text-white text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
              <p>Processing your selection...</p>
            </div>
          </div>
        )}

        <div
          ref={containerRef}
          className="absolute inset-0 w-[110vw] h-full"
          style={{
            zIndex: 10,
            background: "transparent",
          }}
        />
      </div>
    </div>
  );
}

// import { useEffect, useRef, useState } from "react";
// import { MindARThree } from "mind-ar/dist/mindar-image-three.prod.js";
// import * as THREE from "three";
// import { InferenceEngine } from "inferencejs"; // ✅ correct SDK

// export default function ARPointer() {
//   const containerRef = useRef(null);
//   const startedRef = useRef(false);
//   const [handDetected, setHandDetected] = useState(false);
//   const [region, setRegion] = useState(null);
//   const [pointingAtRegion, setPointingAtRegion] = useState(false);
//   const [isInitializing, setIsInitializing] = useState(true);
//   const [qrId, setQrId] = useState(null);
//   const [isProcessing, setIsProcessing] = useState(false);

//   // Roboflow settings
//   const ROBOFLOW_API_KEY = "rf_GPf78psf4uhSQxwNQJgFRlVeoyz1"; // from Roboflow project
//   const ROBOFLOW_MODEL_ID = "fingertip-2"; // your model slug
//   const ROBOFLOW_VERSION = 1;

//   const inferEngineRef = useRef(null);
//   const workerIdRef = useRef(null);

//   const handleSubmit = async (detectedRegion) => {
//     try {
//       setIsProcessing(true);
//       const urlParams = new URLSearchParams(window.location.search);
//       const qrId = urlParams.get("qrId");

//       if (!qrId || !detectedRegion) {
//         alert("Missing QR ID or Region.");
//         return;
//       }

//       window.location.replace(
//         `/eating-habit/selection/result?qrId=${qrId}&region=${detectedRegion}`
//       );
//     } catch (err) {
//       alert("Submission failed: " + err.message);
//     } finally {
//       setIsProcessing(false);
//     }
//   };

//   // ✅ Local inference function (instead of API calls)
// const detectFingertips = async (video) => {
//   if (!inferEngineRef.current || !workerIdRef.current) return [];
//   try {
//     // Create an ImageBitmap from the current video frame
//     const bitmap = await createImageBitmap(video);

//     const predictions = await inferEngineRef.current.infer(
//       workerIdRef.current,
//       bitmap   // ✅ transferable type
//     );

//     bitmap.close?.(); // free GPU memory if supported
//     return predictions;
//   } catch (err) {
//     console.error("Inference error:", err);
//     return [];
//   }
// };

//   useEffect(() => {
//     const urlParams = new URLSearchParams(window.location.search);
//     setQrId(urlParams.get("qrId"));

//     let mindarThree, rafId;
//     let anchors = [];

//     const init = async () => {
//       try {
//         setIsInitializing(true);
//         if (startedRef.current) return;
//         startedRef.current = true;

//         // ✅ Load Roboflow model locally
//         inferEngineRef.current = new InferenceEngine();
//         workerIdRef.current = await inferEngineRef.current.startWorker(
//           ROBOFLOW_MODEL_ID,
//           [ROBOFLOW_VERSION],
//           ROBOFLOW_API_KEY
//         );
//         console.log("Roboflow model loaded.");

//         // Video element
//         const video = document.createElement("video");
//         video.setAttribute("autoplay", "");
//         video.setAttribute("muted", "");
//         video.setAttribute("playsinline", "");
//         video.style.display = "none";
//         document.body.appendChild(video);

//         // Get camera stream
//         const stream = await navigator.mediaDevices.getUserMedia({
//           video: { facingMode: "environment" },
//           audio: false,
//         });
//         video.srcObject = stream;
//         await video.play();

//         // Init MindAR
//         mindarThree = new MindARThree({
//           container: containerRef.current,
//           imageTargetSrc: "targets.mind",
//           video,
//           uiLoading: "no",
//           uiScanning: "no",
//         });

//         const { renderer, scene, camera } = mindarThree;

//         renderer.setPixelRatio(window.devicePixelRatio);
//         renderer.setSize(
//           containerRef.current.clientWidth,
//           containerRef.current.clientHeight
//         );

//         anchors = [
//           mindarThree.addAnchor(0),
//           mindarThree.addAnchor(1),
//           mindarThree.addAnchor(2),
//         ];

//         const targetPositions = [
//           new THREE.Vector3(),
//           new THREE.Vector3(),
//           new THREE.Vector3(),
//         ];
//         const targetSizes = [
//           new THREE.Vector2(200, 200),
//           new THREE.Vector2(200, 200),
//           new THREE.Vector2(200, 200),
//         ];

//         // ✅ Throttle inference (not every frame)
//         let lastCall = 0;
//         const FPS_LIMIT = 3; // 3 predictions/sec

//         const processFrame = async (timestamp) => {
//           // Update anchors
//           anchors.forEach((anchor, index) => {
//             if (anchor.visible) {
//               anchor.group.getWorldPosition(targetPositions[index]);
//             }
//           });

//           if (timestamp - lastCall > 1000 / FPS_LIMIT) {
//             lastCall = timestamp;

//             const predictions = await detectFingertips(video);
//             if (predictions.length > 0) {
//               setHandDetected(true);

//               let isPointingAtTarget = false;
//               let currentRegion = null;

//               predictions.forEach((p) => {
//                 const x = p.bbox.x;
//                 const y = p.bbox.y;

//                 anchors.forEach((anchor, index) => {
//                   if (anchor.visible) {
//                     const position = targetPositions[index];
//                     const size = targetSizes[index];

//                     const vector = position.clone().project(camera);
//                     vector.x = ((vector.x + 1) / 2) * video.videoWidth;
//                     vector.y = (-(vector.y - 1) / 2) * video.videoHeight;

//                     const regionBounds = {
//                       x: vector.x - size.x / 2,
//                       y: vector.y - size.y / 2,
//                       width: size.x,
//                       height: size.y,
//                     };

//                     const insideRegion =
//                       x >= regionBounds.x &&
//                       x <= regionBounds.x + regionBounds.width &&
//                       y >= regionBounds.y &&
//                       y <= regionBounds.y + regionBounds.height;

//                     if (insideRegion) {
//                       isPointingAtTarget = true;
//                       currentRegion = ["distracted", "hurry", "mindfully"][index];
//                     }
//                   }
//                 });
//               });

//               setPointingAtRegion(isPointingAtTarget);
//               if (isPointingAtTarget) {
//                 setRegion(currentRegion);
//                 handleSubmit(currentRegion);
//               } else {
//                 setRegion(null);
//               }
//             } else {
//               setHandDetected(false);
//               setPointingAtRegion(false);
//               setRegion(null);
//             }
//           }

//           renderer.render(scene, camera);
//           rafId = requestAnimationFrame(processFrame);
//         };

//         await mindarThree.start();
//         processFrame();
//         setIsInitializing(false);
//       } catch (error) {
//         console.error("Error initializing AR:", error);
//         setIsInitializing(false);
//       }
//     };

//     init();

//     return () => {
//       if (rafId) cancelAnimationFrame(rafId);
//       if (mindarThree) mindarThree.stop();
//       const videoElements = document.querySelectorAll("video");
//       videoElements.forEach((video) => video.remove());
//     };
//   }, []);

//   return (
//     <div className="fixed inset-0 flex flex-col items-center justify-center p-4 bg-[#f3e8d4] h-[100dvh]">
//       <h1 className="text-2xl font-bold text-[#046a81] mb-4">Scanner</h1>

//       <div
//         className="relative bg-black overflow-hidden"
//         style={{
//           width: "100vw",
//           height: "calc(100vw * 2200 / 1517)",
//           maxHeight: "100vh",
//           maxWidth: "calc(100vh * 1517 / 2200)",
//         }}
//       >
//         {isProcessing && (
//           <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-70 z-20">
//             <div className="text-white text-center">
//               <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
//               <p>Processing your selection...</p>
//             </div>
//           </div>
//         )}
//         <div
//           ref={containerRef}
//           className="absolute inset-0 w-[110vw] h-full"
//           style={{
//             zIndex: 10,
//             background: "transparent",
//           }}
//         />
//       </div>
//     </div>
//   );
// }

// *****************//worked fine it just needs knuckle to be visible
// import { useEffect, useRef, useState } from "react";
// import { Hands } from "@mediapipe/hands";
// import { MindARThree } from "mind-ar/dist/mindar-image-three.prod.js";
// import * as THREE from "three";

// export default function ARPointer() {
//   const containerRef = useRef(null);
//   const startedRef = useRef(false);
//   const [handDetected, setHandDetected] = useState(false);
//   const [region, setRegion] = useState(null);
//   const [pointingAtRegion, setPointingAtRegion] = useState(false);
//   const [isInitializing, setIsInitializing] = useState(true);
//   const [qrId, setQrId] = useState(null);
//   const [isProcessing, setIsProcessing] = useState(false);

//   const handleSubmit = async (detectedRegion) => {
//     try {
//       setIsProcessing(true);
//        const urlParams = new URLSearchParams(window.location.search);
//       const qrId = urlParams.get("qrId");

//       if (!qrId || !detectedRegion) {
//         alert(
//           "Missing QR ID or Region.\n\nqrId: " +
//             qrId +
//             "\nregion: " +
//             detectedRegion
//         );
//         return;
//       }

//       window.location.replace(
//         `/eating-habit/selection/result?qrId=${qrId}&region=${detectedRegion}`
//       );
//     } catch (err) {
//       let errorMessage = "Submission failed. Please try again.";
//       if (err?.message) {
//         errorMessage += `\n\nError: ${err.message}`;
//       }
//       alert(errorMessage);
//     } finally {
//       setIsProcessing(false);
//     }
//   };

//   useEffect(() => {
//     const urlParams = new URLSearchParams(window.location.search);
//     setQrId(urlParams.get("qrId"));

//     let mindarThree, hands, rafId, ctx, canvasEl;
//     let drawConnectors, drawLandmarks;
//     let anchors = [];

//     const init = async () => {
//       try {
//         setIsInitializing(true);

//         await import(
//           "https://cdn.jsdelivr.net/npm/@mediapipe/drawing_utils/drawing_utils.js"
//         );

//         drawConnectors = window.drawConnectors;
//         drawLandmarks = window.drawLandmarks;

//         if (startedRef.current) return;
//         startedRef.current = true;

//         // Create video element
//         const video = document.createElement("video");
//         video.setAttribute("autoplay", "");
//         video.setAttribute("muted", "");
//         video.setAttribute("playsinline", "");
//         video.style.display = "none";
//         document.body.appendChild(video);

//         // Get camera stream
//         const stream = await navigator.mediaDevices.getUserMedia({
//           video: { facingMode: "environment" },
//           audio: false,
//         });
//         video.srcObject = stream;
//         await video.play();

//         // Overlay canvas
//         canvasEl = document.createElement("canvas");
//         canvasEl.width = video.videoWidth || 640;
//         canvasEl.height = video.videoHeight || 480;
//         canvasEl.style.display = "none";
//         document.body.appendChild(canvasEl);
//         ctx = canvasEl.getContext("2d");

//         // Init MindAR with proper sizing
//         mindarThree = new MindARThree({
//           container: containerRef.current,
//           imageTargetSrc: "targets.mind",
//           video,
//           uiLoading: "no",
//           uiScanning: "no",
//         });

//         const { renderer, scene, camera } = mindarThree;

//         // Set renderer to fill container
//         renderer.setPixelRatio(window.devicePixelRatio);
//         renderer.setSize(
//           containerRef.current.clientWidth,
//           containerRef.current.clientHeight
//         );

//         // Create anchors for each target
//         anchors = [
//           mindarThree.addAnchor(0),
//           mindarThree.addAnchor(1),
//           mindarThree.addAnchor(2),
//         ];

//         // Store target positions
//         const targetPositions = [
//           new THREE.Vector3(),
//           new THREE.Vector3(),
//           new THREE.Vector3(),
//         ];
//         const targetSizes = [
//           new THREE.Vector2(200, 200),
//           new THREE.Vector2(200, 200),
//           new THREE.Vector2(200, 200),
//         ];

//         // Init MediaPipe Hands
//         hands = new Hands({
//           locateFile: (file) =>
//             `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`,
//         });
//         hands.setOptions({
//           maxNumHands: 1,
//           modelComplexity: 0,
//           minDetectionConfidence: 0.7,
//           minTrackingConfidence: 0.7,
//         });

//         hands.onResults((results) => {
//           ctx.clearRect(0, 0, canvasEl.width, canvasEl.height);

//           if (results.multiHandLandmarks?.length) {
//             setHandDetected(true);

//             results.multiHandLandmarks.forEach((landmarks) => {
//               const indexTip = landmarks[8];
//               const x = indexTip.x * canvasEl.width;
//               const y = indexTip.y * canvasEl.height;

//               let isPointingAtTarget = false;
//               let currentRegion = null;

//               anchors.forEach((anchor, index) => {
//                 if (anchor.visible) {
//                   const position = targetPositions[index];
//                   const size = targetSizes[index];

//                   const vector = position.clone().project(camera);
//                   vector.x = ((vector.x + 1) / 2) * canvasEl.width;
//                   vector.y = (-(vector.y - 1) / 2) * canvasEl.height;

//                   const regionBounds = {
//                     x: vector.x - size.x/2,
//                     y: vector.y - size.y/2,
//                     width: size.x,
//                     height: size.y,
//                   };

//                   const insideRegion =
//                     x >= regionBounds.x &&
//                     x <= regionBounds.x + regionBounds.width &&
//                     y >= regionBounds.y &&
//                     y <= regionBounds.y + regionBounds.height;

//                   if (insideRegion) {
//                     isPointingAtTarget = true;
//                     currentRegion = ["distracted", "hurry", "mindfully"][index];
//                   }
//                 }
//               });

//               setPointingAtRegion(isPointingAtTarget);

//               if (isPointingAtTarget) {
//                 setRegion(currentRegion);
//                 // Immediately submit when region is detected
//                 handleSubmit(currentRegion);
//               } else {
//                 setRegion(null);
//               }
//             });
//           } else {
//             setHandDetected(false);
//             setPointingAtRegion(false);
//             setRegion(null);
//           }
//         });

//         const processFrame = async () => {
//           anchors.forEach((anchor, index) => {
//             if (anchor.visible) {
//               anchor.group.getWorldPosition(targetPositions[index]);
//             }
//           });

//           await hands.send({ image: video });
//           renderer.render(scene, camera);
//           rafId = requestAnimationFrame(processFrame);
//         };

//         await mindarThree.start();
//         processFrame();
//         setIsInitializing(false);
//       } catch (error) {
//         console.error("Error initializing AR:", error);
//         setIsInitializing(false);
//       }
//     };

//     init();

//     return () => {
//       if (rafId) cancelAnimationFrame(rafId);
//       if (mindarThree) mindarThree.stop();
//       const videoElements = document.querySelectorAll('video');
//       videoElements.forEach(video => video.remove());
//       const canvasElements = document.querySelectorAll('canvas');
//       canvasElements.forEach(canvas => canvas.remove());
//     };
//   }, []);

//   return (
//     <div className="fixed inset-0 flex flex-col items-center justify-center p-4 bg-[#f3e8d4] h-[100dvh]">
//       <h1 className="text-2xl font-bold text-[#046a81] mb-4">
//         Scanner
//       </h1>

//       {/* AR container - matches BMI app styling */}
//       <div
//         className="relative bg-black overflow-hidden"
//         style={{
//           width: "100vw",
//           height: "calc(100vw * 2200 / 1517)",
//           maxHeight: "100vh",
//           maxWidth: "calc(100vh * 1517 / 2200)",
//         }}
//       >
//         {/* {isInitializing && (
//           <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-70 z-20">
//             <div className="text-white text-center">
//               <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
//               <p>Initializing AR experience...</p>
//               <p className="text-sm mt-2">Please allow camera access</p>
//             </div>
//           </div>
//         )} */}
//         {isProcessing && (
//           <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-70 z-20">
//             <div className="text-white text-center">
//               <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
//               <p>Processing your selection...</p>
//             </div>
//           </div>
//         )}
//         <div
//           ref={containerRef}
//           className="absolute inset-0 w-[110vw] h-full"
//           style={{
//             zIndex: 10,
//             background: "transparent",
//           }}
//         />
//       </div>

//       {/* Status card - matches BMI app styling */}
//       {/* <div className="mt-4 w-full">
//         {isInitializing ? (
//           <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 flex items-center gap-3">
//             <div className="w-3 h-3 bg-orange-500 rounded-full animate-pulse"></div>
//             <div>
//               <p className="text-orange-800 font-medium text-sm">
//                 Initializing...
//               </p>
//               <p className="text-orange-600 text-xs">Loading AR components</p>
//             </div>
//           </div>
//         ) : !handDetected ? (
//           <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 flex items-center gap-3">
//             <div className="w-3 h-3 bg-orange-500 rounded-full animate-pulse"></div>
//             <div>
//               <p className="text-orange-800 font-medium text-sm">
//                 No hand detected
//               </p>
//               <p className="text-orange-600 text-xs">
//                 Move your hand into the camera view
//               </p>
//             </div>
//           </div>
//         ) : region ? (
//           <div className="bg-green-50 border border-green-200 rounded-lg p-3 flex items-center gap-3">
//             <div className="w-3 h-3 bg-green-500 rounded-full"></div>
//             <div>
//               <p className="text-green-800 font-medium text-sm">
//                 Region Detected
//               </p>
//               <p className="text-green-600 text-xs">
//                 You are pointing to <strong>{region}</strong>
//               </p>
//             </div>
//           </div>
//         ) : (
//           <div className="bg-green-50 border border-green-200 rounded-lg p-3 flex items-center gap-3">
//             <div className="w-3 h-3 bg-green-500 rounded-full"></div>
//             <div>
//               <p className="text-green-800 font-medium text-sm">
//                 Hand detected
//               </p>
//               <p className="text-green-600 text-xs">
//                 Point at a target region with your index finger
//               </p>
//             </div>
//           </div>
//         )}
//       </div> */}
//     </div>
//   );
// }

// // *******************//detects region perfectly wihout hand
// import React, { useRef, useEffect, useState } from "react";
// import * as THREE from "three";
// import { MindARThree } from "mind-ar/dist/mindar-image-three.prod.js";

// export default function ARPosterSelector() {
//   const containerRef = useRef();
//   const [region, setRegion] = useState(null);

//   useEffect(() => {
//     let mindarThree = null;
//     let started = false;

//     const startAR = async () => {
//       console.log("⏳ Starting minimal MindAR...");
//       mindarThree = new MindARThree({
//         container: containerRef.current,
//         imageTargetSrc: "targets.mind",
//       });

//       const { renderer, scene, camera } = mindarThree;

//       await mindarThree.start();
//       started = true;
//       console.log("✅ MindAR started");

//       const anchor0 = mindarThree.addAnchor(0);
//       anchor0.onTargetFound = () => {
//         console.log("🎯 Region 1 detected");
//         setRegion("distracted");
//       };

//       const anchor1 = mindarThree.addAnchor(1);
//       anchor1.onTargetFound = () => {
//         console.log("🎯 Region 2 detected");
//         setRegion("hurry");
//       };

//       const anchor2 = mindarThree.addAnchor(2);
//       anchor2.onTargetFound = () => {
//         console.log("🎯 Region 3 detected");
//         setRegion("mindfully");
//       };

//       anchor0.onTargetLost = () => setRegion(null);
//       anchor1.onTargetLost = () => setRegion(null);
//       anchor2.onTargetLost = () => setRegion(null);

//       renderer.setAnimationLoop(() => {
//         renderer.render(scene, camera);
//       });
//     };

//     startAR();

//     return () => {
//       if (mindarThree && started) {
//         console.log("🧹 Cleaning up MindAR...");
//         mindarThree.stop();
//       }
//     };
//   }, []);

//   return (
//     <div className="fixed inset-0 flex flex-col items-center justify-center p-4 bg-[#f3e8d4] h-[100dvh]">
//       <h1 className="text-2xl font-bold text-[#046a81] mb-4">AR Region Detection</h1>

//       {/* AR container */}
//       <div
//   className="relative bg-black overflow-hidden rounded-lg"
//   style={{
//     width: "100vw",
//     height: "75vh",
//     maxWidth: "100vw",
//     maxHeight: "75vh",
//   }}
// >
//   <div
//     ref={containerRef}
//     className="absolute inset-0 w-full h-full !block"
//     style={{
//       transform: "none",
//       zIndex: 10, // ensure it's visible
//     }}
//   />
// </div>

//       {/* Region status UI */}
//       <div className="mt-4 w-full max-w-md">
//         {region ? (
//           <div className="bg-green-50 border border-green-200 rounded-lg p-3 flex items-center gap-3">
//             <div className="w-3 h-3 bg-green-500 rounded-full" />
//             <div>
//               <p className="text-green-800 font-medium text-sm">
//                 Region Detected
//               </p>
//               <p className="text-green-600 text-xs">
//                 You are pointing to <strong>{region}</strong>
//               </p>
//             </div>
//           </div>
//         ) : (
//           <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 flex items-center gap-3">
//             <div className="w-3 h-3 bg-orange-500 rounded-full animate-pulse" />
//             <div>
//               <p className="text-orange-800 font-medium text-sm">
//                 No region detected
//               </p>
//               <p className="text-orange-600 text-xs">
//                 Point to one of the defined poster regions
//               </p>
//             </div>
//           </div>
//         )}
//       </div>

//       <div
//         id="match-debug-container"
//         className="mt-4 w-full max-w-[90vw] overflow-auto"
//       />
//     </div>
//   );
// }
