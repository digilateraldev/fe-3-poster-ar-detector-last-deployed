// //P2
// import React, { useRef, useEffect, useState } from "react";
// import * as THREE from "three";
// import { MindARThree } from "mind-ar/dist/mindar-image-three.prod.js";
// import pixelmatch from "pixelmatch";

// // NEW: TFJS imports
// import * as tf from "@tensorflow/tfjs";
// import * as bodyPix from "@tensorflow-models/body-pix";
// import cocoSsd from "@tensorflow-models/coco-ssd";

// const REFERENCE_IMAGES = {
//   distracted: "reference/i_eat_while_distracted.png",
//   hurry: "reference/i_eat_in_a_hurry.png",
//   mindfully: "reference/i_eat_mindfully.png",
// };

// // Helper: Load image in browser
// const loadBrowserImage = (src) => {
//   return new Promise((resolve, reject) => {
//     const img = new Image();
//     img.crossOrigin = "anonymous"; // Important if using public folder
//     img.onload = () => resolve(img);
//     img.onerror = reject;
//     img.src = src;
//   });
// };

// export default function ARPosterSelector() {
//   const containerRef = useRef();
//   const [isInitializing, setIsInitializing] = useState(true);
//   const [regions, setRegions] = useState([]);
//   const [logs, setLogs] = useState([]); // store logs in state
//   const [isProcessing, setIsProcessing] = useState(false);
//   const submittedRef = useRef(false);

//   // TFJS models refs
//   const modelsRef = useRef({
//     bodyPix: null,
//     coco: null,
//     loaded: false,
//   });

//   const addLog = (msg) => {
//     setLogs((prev) => [...prev.slice(-20), msg]); // keep last 20 logs
//   };

//   // handleSubmit
//   const handleSubmit = async (detectedRegion) => {
//     try {
//       setIsProcessing(true);
//       const urlParams = new URLSearchParams(window.location.search);
//       const qrId = urlParams.get("qrId");

//       if (!qrId || !detectedRegion) {
//         alert(`Missing QR ID or Region.\n\nqrId: ${qrId}\nregion: ${detectedRegion}`);
//         return;
//       }

//       window.location.replace(`/eating-habit/selection/result?qrId=${qrId}&region=${detectedRegion}`);
//     } catch (err) {
//       let errorMessage = "Submission failed. Please try again.";
//       if (err?.message) errorMessage += `\n\nError: ${err.message}`;
//       alert(errorMessage);
//     } finally {
//       setIsProcessing(false);
//     }
//   };

//   // Compare current WebGL frame with reference image
//   const compareWithReference = async (webglCanvas, regionName, crop = null, batchMode = false) => {
//     // Create 2D canvas from WebGL
//     const canvas = document.createElement("canvas");
//     canvas.width = webglCanvas.width;
//     canvas.height = webglCanvas.height;
//     const ctx = canvas.getContext("2d");
//     ctx.drawImage(webglCanvas, 0, 0);

//     let frameData;
//     if (crop) {
//       // Crop to region (x, y, width, height)
//       frameData = ctx.getImageData(crop.x, crop.y, crop.width, crop.height);
//     } else {
//       frameData = ctx.getImageData(0, 0, canvas.width, canvas.height);
//     }

//     // Load reference image
//     const refImage = await loadBrowserImage(REFERENCE_IMAGES[regionName]);
//     const refCanvas = document.createElement("canvas");
//     refCanvas.width = crop ? crop.width : canvas.width;
//     refCanvas.height = crop ? crop.height : canvas.height;
//     const refCtx = refCanvas.getContext("2d");
//     refCtx.drawImage(refImage, 0, 0, refCanvas.width, refCanvas.height);
//     const refData = refCtx.getImageData(0, 0, refCanvas.width, refCanvas.height);

//     // Compare
//     const diff = pixelmatch(
//       frameData.data,
//       refData.data,
//       null,
//       refCanvas.width,
//       refCanvas.height,
//       { threshold: 0.05 }
//     );

//     const similarityScore = 1 - diff / (refCanvas.width * refCanvas.height);
//     const scoreRounded = (similarityScore * 100).toFixed(1);

//     if (!batchMode) {
//       addLog(`📸 ${regionName.toUpperCase()} → ${scoreRounded}% match`);
//       if (similarityScore < 0.9) {
//         addLog(`✅ SELECTED: ${regionName.toUpperCase()}`);
//       } else {
//         addLog(`❌ No change: ${regionName}`);
//       }
//     }
//     return similarityScore;
//   };

//   // NEW: TFJS occlusion detector
//   // crop: { x, y, width, height } in pixels relative to renderer.domElement
//   const detectOcclusionWithTFJS = async (webglCanvas, crop) => {
//     const { bodyPix: bodyPixModel, coco: cocoModel, loaded } = modelsRef.current;
//     if (!loaded || !bodyPixModel || !cocoModel) {
//       return { occluded: false, occlusionFraction: 0, reason: "models-not-loaded" };
//     }

//     // create crop canvas
//     const cropCanvas = document.createElement("canvas");
//     cropCanvas.width = crop.width;
//     cropCanvas.height = crop.height;
//     const cropCtx = cropCanvas.getContext("2d");
//     cropCtx.drawImage(webglCanvas, crop.x, crop.y, crop.width, crop.height, 0, 0, crop.width, crop.height);

//     // 1) BodyPix segmentation (person mask)
//     let personMaskFraction = 0;
//     try {
//       // use small configuration - it's faster
//       const segmentation = await bodyPixModel.segmentPerson(cropCanvas, {
//         internalResolution: "low",
//         segmentationThreshold: 0.7,
//       });

//       const { data: segData } = segmentation;
//       let personPixels = 0;
//       for (let i = 0; i < segData.length; i++) {
//         if (segData[i] === 1) personPixels++;
//       }
//       personMaskFraction = personPixels / (crop.width * crop.height);
//     } catch (err) {
//       console.warn("BodyPix segmentation error:", err);
//     }

//     // 2) coco-ssd object detection (bounding boxes)
//     let objectOverlapFraction = 0;
//     try {
//       // detect objects on the crop canvas
//       const detections = await cocoModel.detect(cropCanvas);
//       // compute total area of intersections normalized by crop area
//       const cropArea = crop.width * crop.height;

//       // sum of union area of detections (approx — we simply sum bbox intersection areas; may double-count overlapping boxes)
//       let coveredArea = 0;
//       for (const d of detections) {
//         const [x, y, w, h] = d.bbox; // x,y,w,h relative to cropCanvas
//         // clip
//         const ix = Math.max(0, x);
//         const iy = Math.max(0, y);
//         const iw = Math.max(0, Math.min(w, cropCanvas.width - ix));
//         const ih = Math.max(0, Math.min(h, cropCanvas.height - iy));
//         coveredArea += iw * ih;
//       }
//       // clamp to [0,1]
//       objectOverlapFraction = Math.min(1, coveredArea / cropArea);
//     } catch (err) {
//       console.warn("coco-ssd detection error:", err);
//     }

//     // Combine heuristics:
//     // - BodyPix detects person/hands/arms (pixel-level). coco detects generic objects.
//     // Use max of both as occlusion fraction (conservative).
//     const occlusionFraction = Math.max(personMaskFraction, objectOverlapFraction);

//     // final decision threshold (tune as required)
//     const OCCLUSION_THRESHOLD = 0.15; // 15% of crop covered -> consider occluded
//     const occluded = occlusionFraction >= OCCLUSION_THRESHOLD;

//     const details = {
//       personMaskFraction,
//       objectOverlapFraction,
//       occlusionFraction,
//       OCCLUSION_THRESHOLD,
//     };

//     return { occluded, occlusionFraction, details };
//   };

//   useEffect(() => {
//     let mindarThree = null;
//     let started = false;

//     // Load TFJS models before starting AR
//     const loadModels = async () => {
//       try {
//         addLog("TFJS: initializing...");
//         await tf.setBackend("webgl"); // prefer webgl backend for perf
//         await tf.ready();

//         // load a lightweight BodyPix model
//         addLog("TFJS: loading BodyPix (lightweight)...");
//         const bodyPixModel = await bodyPix.load({
//           architecture: "MobileNetV1",
//           outputStride: 16,
//           multiplier: 0.5, // smaller model
//           quantBytes: 2,
//         });

//         addLog("TFJS: loading coco-ssd...");
//         const cocoModel = await cocoSsd.load();

//         modelsRef.current.bodyPix = bodyPixModel;
//         modelsRef.current.coco = cocoModel;
//         modelsRef.current.loaded = true;
//         addLog("TFJS models loaded.");
//       } catch (err) {
//         console.error("TFJS model load error:", err);
//         addLog("TFJS model load failed: " + err?.message);
//         modelsRef.current.loaded = false;
//       }
//     };

//     const startAR = async () => {
//       // start loading models but don't await blocking UI
//       loadModels();

//       mindarThree = new MindARThree({
//         container: containerRef.current,
//         imageTargetSrc: "targets.mind",
//         maxTrack: 3,
//       });

//       const { renderer, scene, camera } = mindarThree;
//       await mindarThree.start();
//       started = true;
//       setIsInitializing(false);
//       addLog("AR Started");

//       const setupAnchor = (index, name) => {
//         const anchor = mindarThree.addAnchor(index);

//         anchor.onTargetFound = async () => {
//           setRegions((prev) => {
//             const updated = prev.includes(name) ? prev : [...prev, name];

//             // After a small delay, run comparisons and occlusion checks across currentRegions
//             setTimeout(async () => {
//               let currentRegions = updated;
//               let results = [];

//               // Default crop — ideally compute per-anchor crop from anchor geometry
//               const crop = { x: 200, y: 150, width: 400, height: 400 };

//               // For each region do:
//               for (let regionName of currentRegions) {
//                 try {
//                   const similarityPromise = compareWithReference(renderer.domElement, regionName, crop, true);
//                   const occlusionPromise = detectOcclusionWithTFJS(renderer.domElement, crop);

//                   const [similarity, occlusionResult] = await Promise.all([similarityPromise, occlusionPromise]);

//                   results.push({
//                     regionName,
//                     similarity,
//                     occlusion: occlusionResult,
//                   });
//                 } catch (err) {
//                   console.warn("Error comparing/detecting:", err);
//                 }
//               }

//               if (results.length > 0) {
//                 // Log all results
//                 addLog("----- Combined Results -----");
//                 results.forEach((r) => {
//                   addLog(
//                     `${r.regionName.toUpperCase()}: sim=${(r.similarity * 100).toFixed(1)}%, occl=${(
//                       r.occlusion.occlusionFraction * 100
//                     ).toFixed(1)}%`
//                   );
//                 });

//                 // Selection logic:
//                 // - prefer regions with LOWER similarity (less match) AND occlusionFraction high.
//                 // - compute a score that weights both (example: score = similarity - occlusionFraction)
//                 const scored = results.map((r) => ({
//                   ...r,
//                   score: r.similarity - r.occlusion.occlusionFraction, // lower score -> less match & more occlusion
//                 }));
//                 scored.sort((a, b) => a.score - b.score);
//                 const selected = scored[0];

//                 // If selected region appears occluded we log that and submit selection (unless already submitted)
//                 if (selected) {
//                   if (selected.occlusion.occluded) {
//                     addLog(`✅ SELECTED (occluded): ${selected.regionName.toUpperCase()}`);
//                     if (!submittedRef.current) {
//                       submittedRef.current = true;
//                       handleSubmit(selected.regionName);
//                     }
//                   } else {
//                     // Not occluded — fallback: if similarity is very low choose it, else no action
//                     if (selected.similarity < 0.6) {
//                       addLog(`✅ SELECTED (low-sim): ${selected.regionName.toUpperCase()}`);
//                       if (!submittedRef.current) {
//                         submittedRef.current = true;
//                         handleSubmit(selected.regionName);
//                       }
//                     } else {
//                       addLog(`ℹ︎ No region confidently occluded/selected.`);
//                     }
//                   }
//                 }
//               }
//             }, 500);

//             return updated;
//           });
//         };

//         anchor.onTargetLost = () => {
//           addLog(`${name} lost`);
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
//       <h1 className="text-2xl font-bold text-[#046a81] mb-4">
//         AR Coin Detector (TFJS occlusion)
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
//         </div>
//       ) : (
//         <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 mt-4">
//           <p className="text-orange-800 font-medium text-sm">
//             No region detected
//           </p>
//         </div>
//       )}

//       {/* Mobile log panel */}
//       <div className="fixed bottom-2 left-2 right-2 bg-black/80 text-white text-xs p-2 rounded-lg max-h-32 overflow-y-auto font-mono z-50">
//         {logs.map((log, i) => (
//           <div key={i}>{log}</div>
//         ))}
//       </div>
//     </div>
//   );
// }

// //P1
// import React, { useRef, useEffect, useState } from "react";
// import * as THREE from "three";
// import { MindARThree } from "mind-ar/dist/mindar-image-three.prod.js";
// import pixelmatch from "pixelmatch";

// const REFERENCE_IMAGES = {
//   distracted: "reference/i_eat_while_distracted.png",
//   hurry: "reference/i_eat_in_a_hurry.png",
//   mindfully: "reference/i_eat_mindfully.png",
// };

// // Tuning knobs
// // Lower pixelmatch threshold -> more sensitive to differences
// const PIXELMATCH_THRESHOLD = 0.05;
// // Similarity below this means the pattern is likely blocked/occluded
// const BLOCKED_THRESHOLD = 0.9; // 90%

// // Helper: Load image in browser
// const loadBrowserImage = (src) => {
//   return new Promise((resolve, reject) => {
//     const img = new Image();
//     img.crossOrigin = "anonymous"; // Important if using public folder
//     img.onload = () => resolve(img);
//     img.onerror = reject;
//     img.src = src;
//   });
// };

// export default function ARPosterSelector() {
//   const containerRef = useRef();
//   const [isInitializing, setIsInitializing] = useState(true);
//   const [regions, setRegions] = useState([]);
//     const [logs, setLogs] = useState([]); // 🆕 store logs in state
//       const [isProcessing, setIsProcessing] = useState(false);
// const submittedRef = useRef(false);
//   const [blockedRegions, setBlockedRegions] = useState({}); // regionName -> boolean

//   const addLog = (msg) => {
//     setLogs((prev) => [...prev.slice(-10), msg]); // keep last 10 logs
//   };

//   // 🆕 handleSubmit
//   const handleSubmit = async (detectedRegion) => {
//     try {
//       setIsProcessing(true);
//       const urlParams = new URLSearchParams(window.location.search);
//       const qrId = urlParams.get("qrId");

//       if (!qrId || !detectedRegion) {
//         alert(`Missing QR ID or Region.\n\nqrId: ${qrId}\nregion: ${detectedRegion}`);
//         return;
//       }

//       window.location.replace(`/eating-habit/selection/result?qrId=${qrId}&region=${detectedRegion}`);
//     } catch (err) {
//       let errorMessage = "Submission failed. Please try again.";
//       if (err?.message) errorMessage += `\n\nError: ${err.message}`;
//       alert(errorMessage);
//     } finally {
//       setIsProcessing(false);
//     }
//   };

// // Compare current WebGL frame with reference image
// const compareWithReference = async (webglCanvas, regionName, crop = null, batchMode = false) => {
//   // Create 2D canvas from WebGL
//   const canvas = document.createElement("canvas");
//   canvas.width = webglCanvas.width;
//   canvas.height = webglCanvas.height;
//   const ctx = canvas.getContext("2d");
//   ctx.drawImage(webglCanvas, 0, 0);

//   let frameData;
//   if (crop) {
//     // Crop to region (x, y, width, height)
//     frameData = ctx.getImageData(crop.x, crop.y, crop.width, crop.height);
//   } else {
//     frameData = ctx.getImageData(0, 0, canvas.width, canvas.height);
//   }

//   // Load reference image
//   const refImage = await loadBrowserImage(REFERENCE_IMAGES[regionName]);
//   const refCanvas = document.createElement("canvas");
//   refCanvas.width = crop ? crop.width : canvas.width;
//   refCanvas.height = crop ? crop.height : canvas.height;
//   const refCtx = refCanvas.getContext("2d");
//   refCtx.drawImage(refImage, 0, 0, refCanvas.width, refCanvas.height);
//   const refData = refCtx.getImageData(0, 0, refCanvas.width, refCanvas.height);

//   // Compare
//   const diff = pixelmatch(
//     frameData.data,
//     refData.data,
//     null,
//     refCanvas.width,
//     refCanvas.height,
//     { threshold: PIXELMATCH_THRESHOLD }
//   );

//   const similarityScore = 1 - diff / (refCanvas.width * refCanvas.height);
//   const scoreRounded = (similarityScore * 100).toFixed(1);
//   const isBlocked = similarityScore < BLOCKED_THRESHOLD;

//   if (!batchMode) {
//     addLog(`📸 ${regionName.toUpperCase()} → ${scoreRounded}% match ${isBlocked ? "(blocked)" : "(clear)"}`);
//   }
//   return { score: similarityScore, blocked: isBlocked };
// };

//   useEffect(() => {
//     let mindarThree = null;
//     let started = false;

//     const startAR = async () => {
//       mindarThree = new MindARThree({
//         container: containerRef.current,
//         imageTargetSrc: "targets.mind",
//         maxTrack: 3,
//         // uiScanning: "no",
//         // uiLoading: "no"
//       });

//       const { renderer, scene, camera } = mindarThree;
//       await mindarThree.start();
//       started = true;
//       setIsInitializing(false);
//        addLog("AR Started");

//       const setupAnchor = (index, name) => {
//         const anchor = mindarThree.addAnchor(index);

//         anchor.onTargetFound = async () => {
//         //   addLog(`${name} detected`);
//           setRegions((prev) => {
//             // Add region if not already present
//             const updated = prev.includes(name) ? prev : [...prev, name];

//     //         // If this is the last detected region in the set, run comparison for all
//     //         setTimeout(async () => {
//     //           // Get current regions
//     //           let currentRegions = updated;
//     //           // Take snapshot and compare for each region
//     //           let scores = [];
//     //           for (let regionName of currentRegions) {
//     //             const crop = { x: 200, y: 150, width: 400, height: 400 };
//     //             const score = await compareWithReference(renderer.domElement, regionName, crop, true); // pass flag for batch mode
//     //             scores.push({ regionName, score });
//     //           }
//     //           // Find region with lowest similarity
//     //           if (scores.length > 0) {
//     //             scores.sort((a, b) => a.score - b.score); // lower = less similar
//     //             const selectedRegion = scores[0].regionName;

//     //             for (let { regionName } of scores) {
//     //               if (regionName === selectedRegion) {
//     //                 addLog(`✅ SELECTED: ${regionName.toUpperCase()} (lowest match)`);
//     //                 if (!submittedRef.current) {
//     //     submittedRef.current = true;
//     //     handleSubmit(regionName);
//     //   }
//     //               } else {
//     //                 addLog(`❌ Not selected: ${regionName}`);
//     //               }
//     //             }
//     //           }
//     //         }, 500); // slight delay to allow all regions to be set
//     setTimeout(async () => {
//   let currentRegions = updated;
//   let scores = [];

//   for (let regionName of currentRegions) {
//     // TODO: Adjust crop per region if needed
//     const crop = { x: 200, y: 150, width: 400, height: 400 };
//     const { score, blocked } = await compareWithReference(renderer.domElement, regionName, crop, true);
//     scores.push({ regionName, score, blocked });
//     // Update blocked status per region
//     setBlockedRegions((prev) => ({ ...prev, [regionName]: blocked }));
//   }

//   if (scores.length > 0) {
//     // Log all scores before sorting
//     addLog("----- Similarity Scores -----");
//     scores.forEach(({ regionName, score, blocked }) => {
//       addLog(`${regionName.toUpperCase()}: ${(score * 100).toFixed(1)}% ${blocked ? "(blocked)" : "(clear)"}`);
//     });

//     // Sort so the lowest similarity is first
//     scores.sort((a, b) => a.score - b.score);
//     const selectedRegion = scores[0].regionName;

//     addLog(`✅ SELECTED: ${selectedRegion.toUpperCase()} (lowest match)`);

//     if (!submittedRef.current) {
//       submittedRef.current = true;
//       handleSubmit(selectedRegion);
//     }
//   }
// }, 500);

//             return updated;
//           });
//         };

//         anchor.onTargetLost = () => {
//         //   console.log(`${name} lost`);
//            addLog(`${name} lost`);
//           setRegions((prev) => prev.filter((r) => r !== name));
//           setBlockedRegions((prev) => {
//             const next = { ...prev };
//             delete next[name];
//             return next;
//           });
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
//         <div
//           ref={containerRef}
//           className="absolute inset-0 w-[110vw] h-full"
//           style={{ zIndex: 10, background: "transparent" }}
//         />
//       </div>

//       {isInitializing ? (
//         <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 mt-4">
//           <p className="text-orange-800 font-medium text-sm">Initializing...</p>
//           {/* <p className="text-orange-600 text-xs">Loading AR components</p> */}
//         </div>
//       ) : regions.length > 0 ? (
//         <div className="bg-green-50 border border-green-200 rounded-lg p-3 mt-4">
//           <p className="text-green-800 font-medium text-sm">
//             Regions Detected:
//           </p>
//           <ul className="text-green-600 text-xs">
//             {regions.map((r) => (
//               <li key={r}>
//                 • {r} {blockedRegions[r] === true ? "(blocked)" : blockedRegions[r] === false ? "(clear)" : "(checking...)"}
//               </li>
//             ))}
//           </ul>
//         </div>
//       ) : (
//         <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 mt-4">
//           <p className="text-orange-800 font-medium text-sm">
//             No region detected
//           </p>
//           {/* <p className="text-orange-600 text-xs">
//             Point to one of the defined poster regions
//           </p> */}
//         </div>
//       )}

//        {/* Mobile log panel */}
//       <div className="fixed bottom-2 left-2 right-2 bg-black/80 text-white text-xs p-2 rounded-lg max-h-32 overflow-y-auto font-mono z-50">
//         {logs.map((log, i) => (
//           <div key={i}>{log}</div>
//         ))}
//       </div>

//     </div>
//   );
// }





// //1608-rectangular- nw
// import { useEffect, useRef, useState } from "react";

// export default function ARPosterZones() {
//   const videoRef = useRef(null);
//   const canvasRef = useRef(null);
//   const [cvReady, setCvReady] = useState(false);
//   const [referenceMat, setReferenceMat] = useState(null);
//   const [zonesStatus, setZonesStatus] = useState({});
//   const [videoReady, setVideoReady] = useState(false);

//   // Example normalized zones (x,y,w,h in 0-1)
//   const normalizedZones = [
//     { id: "Zone1", x: 0.1, y: 0.1, w: 0.3, h: 0.3 },
//     { id: "Zone2", x: 0.5, y: 0.1, w: 0.3, h: 0.3 },
//     { id: "Zone3", x: 0.1, y: 0.5, w: 0.3, h: 0.3 },
//     { id: "Zone4", x: 0.5, y: 0.5, w: 0.3, h: 0.3 },
//   ];

//   // 🔹 Step 1: Start video
//   useEffect(() => {
//     async function startVideo() {
//       try {
//         const stream = await navigator.mediaDevices.getUserMedia({
//           video: { facingMode: { exact: "environment" } },
//         });
//         videoRef.current.srcObject = stream;
//         await videoRef.current.play();
//       } catch (err) {
//         console.warn("Rear camera not available:", err);

//         try {
//           const fallbackStream = await navigator.mediaDevices.getUserMedia({
//             video: true,
//           });
//           videoRef.current.srcObject = fallbackStream;

//           videoRef.current.onloadedmetadata = () => {
//             console.log(
//               "Video ready:",
//               videoRef.current.videoWidth,
//               videoRef.current.videoHeight
//             );
//             setVideoReady(true); // ✅ trigger re-render
//             videoRef.current
//               .play()
//               .catch((e) => console.error("Fallback play error:", e));
//           };
//         } catch (fallbackErr) {
//           console.error("No camera available:", fallbackErr);
//         }
//       }
//     }

//     startVideo();
//   }, []);

//   // 🔹 Step 2: Dynamically load OpenCV like you did with Mediapipe
//   useEffect(() => {
//     if (cvReady) return;

//     const loadOpenCV = async () => {
//       if (window.cv && typeof window.cv.Mat === "function") {
//         console.log("OpenCV already loaded");
//         setCvReady(true);
//         return;
//       }

//       // inject script if not present
//       if (!document.getElementById("opencv-js")) {
//         const script = document.createElement("script");
//         script.id = "opencv-js";
//         script.src = "https://docs.opencv.org/4.x/opencv.js"; // you can pin a version
//         script.async = true;
//         document.body.appendChild(script);

//         script.onload = () => {
//           window.cv["onRuntimeInitialized"] = () => {
//             console.log("✅ OpenCV.js ready!");
//             setCvReady(true);
//           };
//         };
//       } else {
//         // script already injected, just wait
//         window.cv["onRuntimeInitialized"] = () => {
//           console.log("✅ OpenCV.js ready!");
//           setCvReady(true);
//         };
//       }
//     };

//     loadOpenCV();
//   }, [cvReady]);

//   // 🔹 Step 3: Capture reference frame
//   const captureReference = () => {
//     if (!cvReady || !window.cv || !videoRef.current?.videoWidth) {
//       console.warn("OpenCV not ready or video not initialized");
//       return;
//     }
//     const video = videoRef.current;

//     const width = video.videoWidth;
//     const height = video.videoHeight;

//     if (!width || !height) {
//       console.warn("Video dimensions not ready yet!");
//       return;
//     }

//     // draw current frame to canvas
//     const tempCanvas = document.createElement("canvas");
//     tempCanvas.width = width;
//     tempCanvas.height = height;
//     const tempCtx = tempCanvas.getContext("2d");
//     tempCtx.drawImage(video, 0, 0, width, height);

//     // read it into a Mat
//     const mat = cv.imread(tempCanvas);
//     cv.cvtColor(mat, mat, cv.COLOR_RGBA2GRAY);

//     setReferenceMat(mat.clone());
//     mat.delete();
//   };

//   // 🔹 Step 4: Process frames
//   const processFrame = () => {
//     if (!referenceMat || !cvReady) return;

//     const video = videoRef.current;
//     const canvas = canvasRef.current;
//     const ctx = canvas.getContext("2d");

//     canvas.width = video.videoWidth;
//     canvas.height = video.videoHeight;

//     // const src = new cv.Mat(video.videoHeight, video.videoWidth, cv.CV_8UC4);
//     const gray = new cv.Mat();
//     const diff = new cv.Mat();
//     const thresh = new cv.Mat();

//     // capture current frame via canvas
//     const tempCanvas = document.createElement("canvas");
//     tempCanvas.width = video.videoWidth;
//     tempCanvas.height = video.videoHeight;
//     const tempCtx = tempCanvas.getContext("2d");
//     tempCtx.drawImage(video, 0, 0, video.videoWidth, video.videoHeight);

//     const src = cv.imread(tempCanvas);

//     // const cap = new cv.VideoCapture(video);
//     // cap.read(src);

//     cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);
//     cv.absdiff(gray, referenceMat, diff);
//     cv.threshold(diff, thresh, 30, 255, cv.THRESH_BINARY);

//     const contours = new cv.MatVector();
//     const hierarchy = new cv.Mat();
//     cv.findContours(
//       thresh,
//       contours,
//       hierarchy,
//       cv.RETR_EXTERNAL,
//       cv.CHAIN_APPROX_SIMPLE
//     );

//     let status = {};
//     normalizedZones.forEach((z) => (status[z.id] = "clear"));

//     for (let i = 0; i < contours.size(); ++i) {
//       const rect = cv.boundingRect(contours.get(i));
//       ctx.strokeStyle = "red";
//       ctx.lineWidth = 2;
//       ctx.strokeRect(rect.x, rect.y, rect.width, rect.height);

//       normalizedZones.forEach((zone) => {
//         const zx = zone.x * video.videoWidth;
//         const zy = zone.y * video.videoHeight;
//         const zw = zone.w * video.videoWidth;
//         const zh = zone.h * video.videoHeight;

//         const overlap =
//           rect.x < zx + zw &&
//           rect.x + rect.width > zx &&
//           rect.y < zy + zh &&
//           rect.y + rect.height > zy;

//         if (overlap) status[zone.id] = "blocked";

//         ctx.strokeStyle = status[zone.id] === "blocked" ? "orange" : "green";
//         ctx.lineWidth = 3;
//         ctx.strokeRect(zx, zy, zw, zh);
//       });
//     }

//     setZonesStatus(status);

//     src.delete();
//     gray.delete();
//     diff.delete();
//     thresh.delete();
//     contours.delete();
//     hierarchy.delete();
//   };

//   useEffect(() => {
//     let interval;
//     if (cvReady && referenceMat) {
//       interval = setInterval(processFrame, 200);
//     }
//     return () => clearInterval(interval);
//   }, [referenceMat, cvReady]);

//   return (
//     <div>
//       <video
//         ref={videoRef}
//         autoPlay
//         playsInline
//         muted
//         style={{ width: "100%" }}
//       />
//       <canvas ref={canvasRef} style={{ width: "100%" }} />
//       <button onClick={captureReference} disabled={!cvReady || !videoReady}>
//         {cvReady ? "📸 Capture Poster Reference" : "⏳ Loading OpenCV..."}
//       </button>

//       <pre>{JSON.stringify(zonesStatus, null, 2)}</pre>
//     </div>
//   );
// }


// //modified of 1608 rect for 3 zones - nw
// import { useEffect, useRef, useState } from "react";

// export default function ARPosterZones() {
//   const videoRef = useRef(null);
//   const canvasRef = useRef(null);
//   const [cvReady, setCvReady] = useState(false);
//   const [referenceMat, setReferenceMat] = useState(null);
//   const [zonesStatus, setZonesStatus] = useState({});
//   const [videoReady, setVideoReady] = useState(false);

//   // 🔹 Normalized polygon zones (x,y in 0–1)
//   const normalizedZones = {
//     distracted: [
//       [0.463, 0.305],
//       [1, 0.296],
//       [1, 0.596],
//       [0.542, 0.603],
//     ],
//     hurry: [
//       [0.06, 0.5],
//       [0.51, 0.504],
//       [0.505, 0.835],
//       [0.055, 0.84],
//     ],
//     mindfully: [
//       [0.5, 0.65],
//       [1, 0.645],
//       [1, 1],
//       [0.48, 1],
//     ],
//   };

//   // 🔹 Start video
//   useEffect(() => {
//     async function startVideo() {
//       try {
//         const stream = await navigator.mediaDevices.getUserMedia({
//           video: { facingMode: { exact: "environment" } },
//         });
//         videoRef.current.srcObject = stream;
//         await videoRef.current.play();
//         setVideoReady(true);
//       } catch (err) {
//         console.warn("Rear camera not available:", err);
//         try {
//           const fallbackStream = await navigator.mediaDevices.getUserMedia({
//             video: true,
//           });
//           videoRef.current.srcObject = fallbackStream;
//           videoRef.current.onloadedmetadata = () => {
//             setVideoReady(true);
//             videoRef.current
//               .play()
//               .catch((e) => console.error("Fallback play error:", e));
//           };
//         } catch (fallbackErr) {
//           console.error("No camera available:", fallbackErr);
//         }
//       }
//     }
//     startVideo();
//   }, []);

//   // 🔹 Load OpenCV
//   useEffect(() => {
//     if (cvReady) return;
//     const loadOpenCV = async () => {
//       if (window.cv && typeof window.cv.Mat === "function") {
//         setCvReady(true);
//         return;
//       }
//       if (!document.getElementById("opencv-js")) {
//         const script = document.createElement("script");
//         script.id = "opencv-js";
//         script.src = "https://docs.opencv.org/4.x/opencv.js";
//         script.async = true;
//         document.body.appendChild(script);
//         script.onload = () => {
//           window.cv["onRuntimeInitialized"] = () => {
//             setCvReady(true);
//           };
//         };
//       } else {
//         window.cv["onRuntimeInitialized"] = () => {
//           setCvReady(true);
//         };
//       }
//     };
//     loadOpenCV();
//   }, [cvReady]);

//   // 🔹 Capture reference
//   const captureReference = () => {
//     if (!cvReady || !videoRef.current?.videoWidth) return;
//     const video = videoRef.current;
//     const width = video.videoWidth;
//     const height = video.videoHeight;

//     const tempCanvas = document.createElement("canvas");
//     tempCanvas.width = width;
//     tempCanvas.height = height;
//     const tempCtx = tempCanvas.getContext("2d");
//     tempCtx.drawImage(video, 0, 0, width, height);

//     const mat = cv.imread(tempCanvas);
//     cv.cvtColor(mat, mat, cv.COLOR_RGBA2GRAY);
//     setReferenceMat(mat.clone());
//     mat.delete();
//   };

//   // 🔹 Process frames
//   const processFrame = () => {
//     if (!referenceMat || !cvReady) return;
//     const video = videoRef.current;
//     const canvas = canvasRef.current;
//     const ctx = canvas.getContext("2d");

//     canvas.width = video.videoWidth;
//     canvas.height = video.videoHeight;

//     const tempCanvas = document.createElement("canvas");
//     tempCanvas.width = video.videoWidth;
//     tempCanvas.height = video.videoHeight;
//     const tempCtx = tempCanvas.getContext("2d");
//     tempCtx.drawImage(video, 0, 0, video.videoWidth, video.videoHeight);

//     const src = cv.imread(tempCanvas);
//     const gray = new cv.Mat();
//     const diff = new cv.Mat();
//     const thresh = new cv.Mat();

//     cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);
//     cv.absdiff(gray, referenceMat, diff);
//     cv.threshold(diff, thresh, 30, 255, cv.THRESH_BINARY);

//     const contours = new cv.MatVector();
//     const hierarchy = new cv.Mat();
//     cv.findContours(
//       thresh,
//       contours,
//       hierarchy,
//       cv.RETR_EXTERNAL,
//       cv.CHAIN_APPROX_SIMPLE
//     );

//     let status = {};
//     Object.keys(normalizedZones).forEach((id) => (status[id] = "clear"));

//     // Scale normalized polygons to video size
//     const scaledZones = {};
//     for (const [id, points] of Object.entries(normalizedZones)) {
//       scaledZones[id] = points.map(([nx, ny]) => [
//         nx * video.videoWidth,
//         ny * video.videoHeight,
//       ]);
//     }

//     // Draw zones (default green)
//     for (const [id, polygon] of Object.entries(scaledZones)) {
//       ctx.beginPath();
//       ctx.moveTo(polygon[0][0], polygon[0][1]);
//       polygon.slice(1).forEach(([x, y]) => ctx.lineTo(x, y));
//       ctx.closePath();
//       ctx.strokeStyle = "green";
//       ctx.lineWidth = 3;
//       ctx.stroke();
//     }

//     // Check overlap with detected contours
//     for (let i = 0; i < contours.size(); ++i) {
//       const rect = cv.boundingRect(contours.get(i));
//       const center = { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };

//       for (const [id, polygon] of Object.entries(scaledZones)) {
//         const polyMat = cv.matFromArray(
//           polygon.length,
//           1,
//           cv.CV_32SC2,
//           polygon.flat()
//         );
//         const result = cv.pointPolygonTest(polyMat, center, false);
//         polyMat.delete();

//         if (result >= 0) {
//           status[id] = "blocked";
//         }
//       }
//     }

//     // Re-draw zones with updated color
//     for (const [id, polygon] of Object.entries(scaledZones)) {
//       ctx.beginPath();
//       ctx.moveTo(polygon[0][0], polygon[0][1]);
//       polygon.slice(1).forEach(([x, y]) => ctx.lineTo(x, y));
//       ctx.closePath();
//       ctx.strokeStyle = status[id] === "blocked" ? "orange" : "green";
//       ctx.lineWidth = 3;
//       ctx.stroke();
//     }

//     setZonesStatus(status);

//     src.delete();
//     gray.delete();
//     diff.delete();
//     thresh.delete();
//     contours.delete();
//     hierarchy.delete();
//   };

//   useEffect(() => {
//     let interval;
//     if (cvReady && referenceMat) {
//       interval = setInterval(processFrame, 200);
//     }
//     return () => clearInterval(interval);
//   }, [referenceMat, cvReady]);

//   return (
//     <div style={{ position: "relative", width: "100%", height: "80vh"}}>
//       {/* Video layer */}
//       <video
//         ref={videoRef}
//         autoPlay
//         playsInline
//         muted
//         style={{ width: "100%", height: "100%", display: "block" }}
//       />
//       {/* Canvas overlay */}
//       <canvas
//         ref={canvasRef}
//         style={{
//           position: "absolute",
//           top: 0,
//           left: 0,
//           width: "100%",
//           height: "100%",
//           pointerEvents: "none", // so canvas doesn’t block clicks
//         }}
//       />
//       <button
//         onClick={captureReference}
//         disabled={!cvReady || !videoReady}
//         style={{ marginTop: "10px" }}
//       >
//         {cvReady ? "📸 Capture Poster Reference" : "⏳ Loading OpenCV..."}
//       </button>
//       <pre>{JSON.stringify(zonesStatus, null, 2)}</pre>
//     </div>
//   );
// }










// import React, { useRef, useEffect, useState } from "react";
// import * as THREE from "three";
// import { MindARThree } from "mind-ar/dist/mindar-image-three.prod.js";
// import pixelmatch from "pixelmatch";

// const REFERENCE_IMAGES = {
//   distracted: "reference/i_eat_while_distracted.png",
//   hurry: "reference/i_eat_in_a_hurry.png",
//   mindfully: "reference/i_eat_mindfully.png",
// };

// // Helper: Load image in browser
// const loadBrowserImage = (src) => {
//   return new Promise((resolve, reject) => {
//     const img = new Image();
//     img.crossOrigin = "anonymous"; // Important if using public folder
//     img.onload = () => resolve(img);
//     img.onerror = reject;
//     img.src = src;
//   });
// };

// export default function ARPosterSelector() {
//   const containerRef = useRef();
//   const [isInitializing, setIsInitializing] = useState(true);
//   const [regions, setRegions] = useState([]);
//     const [logs, setLogs] = useState([]); // 🆕 store logs in state
//       const [isProcessing, setIsProcessing] = useState(false);
// const submittedRef = useRef(false);

//   const addLog = (msg) => {
//     setLogs((prev) => [...prev.slice(-10), msg]); // keep last 10 logs
//   };

//   // 🆕 handleSubmit
//   const handleSubmit = async (detectedRegion) => {
//     try {
//       setIsProcessing(true);
//       const urlParams = new URLSearchParams(window.location.search);
//       const qrId = urlParams.get("qrId");

//       if (!qrId || !detectedRegion) {
//         alert(`Missing QR ID or Region.\n\nqrId: ${qrId}\nregion: ${detectedRegion}`);
//         return;
//       }

//       window.location.replace(`/eating-habit/selection/result?qrId=${qrId}&region=${detectedRegion}`);
//     } catch (err) {
//       let errorMessage = "Submission failed. Please try again.";
//       if (err?.message) errorMessage += `\n\nError: ${err.message}`;
//       alert(errorMessage);
//     } finally {
//       setIsProcessing(false);
//     }
//   };

// // Compare current WebGL frame with reference image
// const compareWithReference = async (webglCanvas, regionName, crop = null, batchMode = false) => {
//   // Create 2D canvas from WebGL
//   const canvas = document.createElement("canvas");
//   canvas.width = webglCanvas.width;
//   canvas.height = webglCanvas.height;
//   const ctx = canvas.getContext("2d");
//   ctx.drawImage(webglCanvas, 0, 0);

//   let frameData;
//   if (crop) {
//     // Crop to region (x, y, width, height)
//     frameData = ctx.getImageData(crop.x, crop.y, crop.width, crop.height);
//   } else {
//     frameData = ctx.getImageData(0, 0, canvas.width, canvas.height);
//   }

//   // Load reference image
//   const refImage = await loadBrowserImage(REFERENCE_IMAGES[regionName]);
//   const refCanvas = document.createElement("canvas");
//   refCanvas.width = crop ? crop.width : canvas.width;
//   refCanvas.height = crop ? crop.height : canvas.height;
//   const refCtx = refCanvas.getContext("2d");
//   refCtx.drawImage(refImage, 0, 0, refCanvas.width, refCanvas.height);
//   const refData = refCtx.getImageData(0, 0, refCanvas.width, refCanvas.height);

//   // Compare
//   const diff = pixelmatch(
//     frameData.data,
//     refData.data,
//     null,
//     refCanvas.width,
//     refCanvas.height,
//     { threshold: 0.05 }
//   );

//   const similarityScore = 1 - diff / (refCanvas.width * refCanvas.height);
//   const scoreRounded = (similarityScore * 100).toFixed(1);

//   if (!batchMode) {
//     addLog(`📸 ${regionName.toUpperCase()} → ${scoreRounded}% match`);
//     if (similarityScore < 0.9) {
//       addLog(`✅ SELECTED: ${regionName.toUpperCase()}`);
//     } else {
//       addLog(`❌ No change: ${regionName}`);
//     }
//   }
//   return similarityScore;
// };

//   useEffect(() => {
//     let mindarThree = null;
//     let started = false;

//     const startAR = async () => {
//       mindarThree = new MindARThree({
//         container: containerRef.current,
//         imageTargetSrc: "targets.mind",
//         maxTrack: 3,
//         // uiScanning: "no",
//         // uiLoading: "no"
//       });

//       const { renderer, scene, camera } = mindarThree;
//       await mindarThree.start();
//       started = true;
//       setIsInitializing(false);
//        addLog("AR Started");

//       const setupAnchor = (index, name) => {
//         const anchor = mindarThree.addAnchor(index);

//         anchor.onTargetFound = async () => {
//         //   addLog(`${name} detected`);
//           setRegions((prev) => {
//             // Add region if not already present
//             const updated = prev.includes(name) ? prev : [...prev, name];

//     //         // If this is the last detected region in the set, run comparison for all
//     //         setTimeout(async () => {
//     //           // Get current regions
//     //           let currentRegions = updated;
//     //           // Take snapshot and compare for each region
//     //           let scores = [];
//     //           for (let regionName of currentRegions) {
//     //             const crop = { x: 200, y: 150, width: 400, height: 400 };
//     //             const score = await compareWithReference(renderer.domElement, regionName, crop, true); // pass flag for batch mode
//     //             scores.push({ regionName, score });
//     //           }
//     //           // Find region with lowest similarity
//     //           if (scores.length > 0) {
//     //             scores.sort((a, b) => a.score - b.score); // lower = less similar
//     //             const selectedRegion = scores[0].regionName;

//     //             for (let { regionName } of scores) {
//     //               if (regionName === selectedRegion) {
//     //                 addLog(`✅ SELECTED: ${regionName.toUpperCase()} (lowest match)`);
//     //                 if (!submittedRef.current) {
//     //     submittedRef.current = true;
//     //     handleSubmit(regionName);
//     //   }
//     //               } else {
//     //                 addLog(`❌ Not selected: ${regionName}`);
//     //               }
//     //             }
//     //           }
//     //         }, 500); // slight delay to allow all regions to be set
//     setTimeout(async () => {
//   let currentRegions = updated;
//   let scores = [];

//   for (let regionName of currentRegions) {
//     // TODO: Adjust crop per region if needed
//     const crop = { x: 200, y: 150, width: 400, height: 400 };
//     const score = await compareWithReference(renderer.domElement, regionName, crop, true);
//     scores.push({ regionName, score });
//   }

//   if (scores.length > 0) {
//     // Log all scores before sorting
//     addLog("----- Similarity Scores -----");
//     scores.forEach(({ regionName, score }) => {
//       addLog(`${regionName.toUpperCase()}: ${(score * 100).toFixed(1)}%`);
//     });

//     // Sort so the lowest similarity is first
//     scores.sort((a, b) => a.score - b.score);
//     const selectedRegion = scores[0].regionName;

//     addLog(`✅ SELECTED: ${selectedRegion.toUpperCase()} (lowest match)`);

//     if (!submittedRef.current) {
//       submittedRef.current = true;
//       handleSubmit(selectedRegion);
//     }
//   }
// }, 500);

//             return updated;
//           });
//         };

//         anchor.onTargetLost = () => {
//         //   console.log(`${name} lost`);
//            addLog(`${name} lost`);
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
//         <div
//           ref={containerRef}
//           className="absolute inset-0 w-[110vw] h-full"
//           style={{ zIndex: 10, background: "transparent" }}
//         />
//       </div>

//       {isInitializing ? (
//         <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 mt-4">
//           <p className="text-orange-800 font-medium text-sm">Initializing...</p>
//           {/* <p className="text-orange-600 text-xs">Loading AR components</p> */}
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
//         </div>
//       ) : (
//         <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 mt-4">
//           <p className="text-orange-800 font-medium text-sm">
//             No region detected
//           </p>
//           {/* <p className="text-orange-600 text-xs">
//             Point to one of the defined poster regions
//           </p> */}
//         </div>
//       )}

//        {/* Mobile log panel */}
//       <div className="fixed bottom-2 left-2 right-2 bg-black/80 text-white text-xs p-2 rounded-lg max-h-32 overflow-y-auto font-mono z-50">
//         {logs.map((log, i) => (
//           <div key={i}>{log}</div>
//         ))}
//       </div>

//     </div>
//   );
// }
