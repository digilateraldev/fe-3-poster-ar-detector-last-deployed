import React, { useEffect, useRef, useState } from "react";
import { Hands } from "@mediapipe/hands";

// Change to array format if you want simple iteration
const referenceRegions = [
  {
    name: "hurry",
    references: [
      // { path: "/eating-habit/reference/i_eat_in_a_hurry-text.png" },
      { path: "/eating-habit/reference/i_eat_in_a_hurry.png" },
    ],
  },
  {
    name: "mindfully",
    references: [
      // { path: "/eating-habit/reference/i_eat_mindfully-text.png" },
      { path: "/eating-habit/reference/i_eat_mindfully.png" },
    ],
  },
  {
    name: "distracted",
    references: [
      // { path: "/eating-habit/reference/i_eat_while_distracted-text.png" },
      { path: "/eating-habit/reference/i_eat_while_distracted.png" },
    ],
  },
];

// const drawMatchLinesManual = (roiCanvasCtx, kp1, kp2, matches, offsetX = 0) => {
//   if (
//     !matches ||
//     typeof matches.get !== "function" ||
//     typeof matches.size !== "function"
//   ) {
//     console.warn("Invalid matches object:", matches);
//     return;
//   }

//   if (
//     !kp1 ||
//     !kp2 ||
//     typeof kp1.get !== "function" ||
//     typeof kp2.get !== "function"
//   ) {
//     console.warn("Invalid keypoint vectors:", kp1, kp2);
//     return;
//   }

//   roiCanvasCtx.strokeStyle = "red";
//   roiCanvasCtx.lineWidth = 1;

//   for (let i = 0; i < matches.size(); i++) {
//     const match = matches.get(i);
//     const p1 = kp1.get(match.queryIdx).pt;
//     const p2 = kp2.get(match.trainIdx).pt;

//     roiCanvasCtx.beginPath();
//     roiCanvasCtx.moveTo(p1.x, p1.y);
//     roiCanvasCtx.lineTo(p2.x + offsetX, p2.y);
//     roiCanvasCtx.stroke();
//   }
// };

const drawMatchLinesManual = (ctx, kp1, kp2, matches, offsetX = 0) => {
  if (!ctx || !kp1 || !kp2 || !matches) {
    console.warn("Missing required parameters for drawMatchLinesManual");
    return;
  }

  try {
    ctx.strokeStyle = "rgba(255, 0, 0, 0.7)";
    ctx.lineWidth = 2;

    for (let i = 0; i < matches.size(); i++) {
      try {
        const match = matches.get(i);
        const p1 = kp1.get(match.queryIdx)?.pt;
        const p2 = kp2.get(match.trainIdx)?.pt;

        if (p1 && p2) {
          ctx.beginPath();
          ctx.moveTo(p1.x, p1.y);
          ctx.lineTo(p2.x + offsetX, p2.y);
          ctx.stroke();
        }
      } catch (e) {
        console.warn("Error drawing match line:", e);
      }
    }
  } catch (err) {
    console.error("Error in drawMatchLinesManual:", err);
  }
};


const SimplePosterSelector = () => {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const pointerRef = useRef(null);
  const containerRef = useRef(null);
  const detectionCanvasRef = useRef(null);
  const handDetectionTimer = useRef(null);

  const [warningMessage, setWarningMessage] = useState("Initializing...");
  const [detectionMode, setDetectionMode] = useState("hand");
  const [isDetected, setIsDetected] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [matchScores, setMatchScores] = useState([]);
  const [errorDetails, setErrorDetails] = useState(null);

  const handDetectionFailCount = useRef(0);
  const handsRef = useRef(null);

  // Helper function to load images (same as SquareDetector)
  const loadImage = async (src) => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0);
        resolve(ctx.getImageData(0, 0, canvas.width, canvas.height));
      };
      img.onerror = reject;
      img.src = src;
    });
  };

  const cmToPixels = (cm) => {
    // Assume standard screen resolution: 96 DPI (dots per inch)
    const dpi = 96;
    const inches = cm / 2.54;
    return Math.round(inches * dpi);
  };

  // const compareWithReferenceImages = async (
  //   capturedMat,
  //   pointerX,
  //   pointerY
  // ) => {
  //   const orb = new cv.ORB();
  //   const matcher = new cv.BFMatcher(cv.NORM_HAMMING, true);

  //   // // Extract larger ROI
  //   // const roiSize = 400;
  //   // const roi = capturedMat.roi(new cv.Rect(
  //   //   Math.max(0, pointerX - roiSize/2),
  //   //   Math.max(0, pointerY - roiSize/2),
  //   //   Math.min(roiSize, capturedMat.cols - pointerX + roiSize/2),
  //   //   Math.min(roiSize, capturedMat.rows - pointerY + roiSize/2)
  //   // ));
  //   // Step 1: Calculate ROI size in pixels from cm
  //   const radius = cmToPixels(4); // 4 cm in pixels
  //   const roiX = Math.max(0, pointerX - radius);
  //   const roiY = Math.max(0, pointerY - radius);
  //   const roiWidth = Math.min(radius * 2, capturedMat.cols - roiX);
  //   const roiHeight = Math.min(radius * 2, capturedMat.rows - roiY);
  //   const roiRect = new cv.Rect(roiX, roiY, roiWidth, roiHeight);

  //   // Step 2: Extract rectangular region
  //   const roi = capturedMat.roi(roiRect);

  //   // Step 3: Create circular mask
  //   const mask = new cv.Mat.zeros(roi.rows, roi.cols, cv.CV_8UC1);
  //   cv.circle(
  //     mask,
  //     new cv.Point(roi.cols / 2, roi.rows / 2),
  //     radius,
  //     new cv.Scalar(255, 255, 255, 255),
  //     -1
  //   );

  //   // Step 4: Convert to grayscale and mask
  //   const grayRoi = new cv.Mat();
  //   cv.cvtColor(roi, grayRoi, cv.COLOR_RGBA2GRAY);

  //   // Step 5: Apply mask (bitwise AND)
  //   const maskedRoi = new cv.Mat();
  //   cv.bitwise_and(grayRoi, mask, maskedRoi);

  //   // Optional: clean up
  //   mask.delete();
  //   grayRoi.delete();
  //   roi.delete();

  //   // // Convert to grayscale
  //   // const grayRoi = new cv.Mat();
  //   // cv.cvtColor(roi, grayRoi, cv.COLOR_RGBA2GRAY);

  //   // const roiMat = grayRoi.clone();
  //   const roiMat = maskedRoi.clone();

  //   // Detect features
  //   const kp1 = new cv.KeyPointVector();
  //   const desc1 = new cv.Mat();
  //   // orb.detectAndCompute(grayRoi, new cv.Mat(), kp1, desc1);
  //   orb.detectAndCompute(maskedRoi, new cv.Mat(), kp1, desc1);

  //   // let bestMatch = null;
  //   // let bestScore = 0;

  //   let bestMatch = null;
  //   let bestScore = 0;

  //   // ADD THESE to hold debug match data
  //   let bestRefMat = null;
  //   let bestKp2 = null;
  //   let bestMatches = null;

  //   for (const region of referenceRegions) {
  //     for (const ref of region.references) {
  //       // Load and process reference
  //       const refImg = await loadImage(ref.path);
  //       const refMat = cv.matFromImageData(refImg);
  //       const grayRef = new cv.Mat();
  //       cv.cvtColor(refMat, grayRef, cv.COLOR_RGBA2GRAY);

  //       const kp2 = new cv.KeyPointVector();
  //       const desc2 = new cv.Mat();
  //       orb.detectAndCompute(grayRef, new cv.Mat(), kp2, desc2);

  //       if (!desc1.empty() && !desc2.empty()) {
  //         const matches = new cv.DMatchVector();
  //         matcher.match(desc1, desc2, matches);

  //         // Filter good matches
  //         const goodMatches = [];
  //         for (let i = 0; i < matches.size(); i++) {
  //           const match = matches.get(i);
  //           if (match.distance < 70) {
  //             // Adjust threshold
  //             goodMatches.push(match);
  //           }
  //         }

  //         if (goodMatches.length > bestScore) {
  //           bestScore = goodMatches.length;
  //           bestMatch = region.name;
  //           // ✅ Save best visual match data
  //           bestRefMat = grayRef; // or use refMat if you want colored view
  //           bestKp2 = kp2;
  //           bestMatches = new cv.DMatchVector();
  //           for (let i = 0; i < goodMatches.length; i++) {
  //             bestMatches.push_back(goodMatches[i]); // ensure they're real cv.DMatch
  //           }
  //         }
  //       }
  //     }
  //   }

  //   // return bestMatch;
  //   return {
  //     name: bestMatch,
  //     matchCount: bestScore,
  //     keypoints1: kp1,
  //     keypoints2: bestKp2,
  //     matches: bestMatches,
  //     roiMat,
  //     matchedRefImage: bestRefMat,
  //   };
  // };

//   //left gray right colored
// const compareWithReferenceImages = async (capturedMat, pointerX, pointerY) => {
//   const orb = new cv.ORB();
//   const matcher = new cv.BFMatcher(cv.NORM_HAMMING, true);

//   // Step 1: Define circular ROI from pointer position
//   const radius = cmToPixels(4); // 4 cm radius
//   const roiX = Math.max(0, pointerX - radius);
//   const roiY = Math.max(0, pointerY - radius);
//   const roiWidth = Math.min(radius * 2, capturedMat.cols - roiX);
//   const roiHeight = Math.min(radius * 2, capturedMat.rows - roiY);
//   const roiRect = new cv.Rect(roiX, roiY, roiWidth, roiHeight);
//   const roi = capturedMat.roi(roiRect);

//   // Step 2: Apply circular mask
//   const mask = new cv.Mat.zeros(roi.rows, roi.cols, cv.CV_8UC1);
//   cv.circle(
//     mask,
//     new cv.Point(roi.cols / 2, roi.rows / 2),
//     radius,
//     new cv.Scalar(255),
//     -1
//   );

//   // Step 3: Convert to grayscale for feature detection
//   const grayRoi = new cv.Mat();
//   cv.cvtColor(roi, grayRoi, cv.COLOR_RGBA2GRAY);

//   // Step 4: Apply mask to grayscale image
//   const maskedRoi = new cv.Mat();
//   cv.bitwise_and(grayRoi, mask, maskedRoi);

//   // Step 5: Detect keypoints and descriptors in ROI
//   const kp1 = new cv.KeyPointVector();
//   const desc1 = new cv.Mat();
//   orb.detectAndCompute(maskedRoi, new cv.Mat(), kp1, desc1);

//   // Cleanup temporary mats
//   mask.delete();
//   grayRoi.delete();
//   roi.delete();

//   // --- Matching loop ---
//   let bestMatch = null;
//   let bestScore = 0;
//   let bestRefMat = null;
//   let bestKp2 = null;
//   let bestMatches = null;

//   try {
//     for (const region of referenceRegions) {
//       for (const ref of region.references) {
//         let refImg, refMat, grayRef, kp2, desc2;
        
//         try {
//           refImg = await loadImage(ref.path);
//           refMat = cv.matFromImageData(refImg);
//           grayRef = new cv.Mat();
//           cv.cvtColor(refMat, grayRef, cv.COLOR_RGBA2GRAY);

//           kp2 = new cv.KeyPointVector();
//           desc2 = new cv.Mat();
//           orb.detectAndCompute(grayRef, new cv.Mat(), kp2, desc2);

//           if (!desc1.empty() && !desc2.empty()) {
//             const matches = new cv.DMatchVector();
//             matcher.match(desc1, desc2, matches);

//             const goodMatches = [];
//             for (let i = 0; i < matches.size(); i++) {
//               const match = matches.get(i);
//               if (match.distance < 70) {
//                 goodMatches.push(match);
//               }
//             }

//             if (goodMatches.length > bestScore) {
//               // Clean up previous best matches if they exist
//               if (bestRefMat) bestRefMat.delete();
//               if (bestKp2) bestKp2.delete();
//               if (bestMatches) bestMatches.delete();

//               bestScore = goodMatches.length;
//               bestMatch = region.name;
//               bestRefMat = refMat.clone(); // Clone to prevent deletion
//               bestKp2 = kp2.clone();
              
//               bestMatches = new cv.DMatchVector();
//               for (let i = 0; i < goodMatches.length; i++) {
//                 bestMatches.push_back(goodMatches[i]);
//               }
              
//               // Don't delete refMat since we're keeping it
//               refMat = null; // Prevent deletion in finally block
//             }
//           }
//         } finally {
//           // Clean up current iteration mats
//           if (grayRef) grayRef.delete();
//           if (desc2) desc2.delete();
//           if (kp2 && kp2 !== bestKp2) kp2.delete();
//           if (refMat) refMat.delete(); // Only delete if we didn't keep it
//         }
//       }
//     }

//     if (bestMatch) {
//       return {
//         name: bestMatch,
//         matchCount: bestScore,
//         keypoints1: kp1,
//         keypoints2: bestKp2,
//         matches: bestMatches,
//         roiMat: maskedRoi.clone(),
//         matchedRefImage: bestRefMat,
//       };
//     }
//     return null;
//   } finally {
//     // Clean up if we didn't return a result
//     if (!bestMatch) {
//       kp1.delete();
//       desc1.delete();
//       maskedRoi.delete();
//       if (bestRefMat) bestRefMat.delete();
//       if (bestKp2) bestKp2.delete();
//       if (bestMatches) bestMatches.delete();
//     }
//   }
// };

const compareWithReferenceImages = async (capturedMat, pointerX, pointerY) => {
  const orb = new cv.ORB();
  const matcher = new cv.BFMatcher(cv.NORM_HAMMING, true);

  // Step 1: Define circular ROI from pointer position
  const radius = cmToPixels(4); // 4 cm radius
  const roiX = Math.max(0, pointerX - radius);
  const roiY = Math.max(0, pointerY - radius);
  const roiWidth = Math.min(radius * 2, capturedMat.cols - roiX);
  const roiHeight = Math.min(radius * 2, capturedMat.rows - roiY);
  const roiRect = new cv.Rect(roiX, roiY, roiWidth, roiHeight);
  
  // Extract color ROI
  const colorRoi = capturedMat.roi(roiRect);
  
  // Step 2: Apply circular mask to color image
  const mask = new cv.Mat.zeros(colorRoi.rows, colorRoi.cols, cv.CV_8UC1);
  cv.circle(
    mask,
    new cv.Point(colorRoi.cols / 2, colorRoi.rows / 2),
    radius,
    new cv.Scalar(255),
    -1
  );

  // Apply mask to color image
  const maskedColor = new cv.Mat();
  cv.bitwise_and(colorRoi, colorRoi, maskedColor, mask);

  // Step 3: Detect keypoints and descriptors in color ROI
  const kp1 = new cv.KeyPointVector();
  const desc1 = new cv.Mat();
  orb.detectAndCompute(maskedColor, new cv.Mat(), kp1, desc1);

  // Cleanup temporary mats
  mask.delete();
  colorRoi.delete();

  // --- Matching loop ---
  let bestMatch = null;
  let bestScore = 0;
  let bestRefMat = null;
  let bestKp2 = null;
  let bestMatches = null;

  try {
    for (const region of referenceRegions) {
      for (const ref of region.references) {
        let refImg, refMat, kp2, desc2;
        
        try {
          refImg = await loadImage(ref.path);
          refMat = cv.matFromImageData(refImg);

          kp2 = new cv.KeyPointVector();
          desc2 = new cv.Mat();
          orb.detectAndCompute(refMat, new cv.Mat(), kp2, desc2);

          if (!desc1.empty() && !desc2.empty()) {
            const matches = new cv.DMatchVector();
            matcher.match(desc1, desc2, matches);

            // Filter matches by distance
            const goodMatches = [];
            for (let i = 0; i < matches.size(); i++) {
              const match = matches.get(i);
              if (match.distance < 70) {
                goodMatches.push(match);
              }
            }

            if (goodMatches.length > bestScore) {
              // Clean up previous best matches
              if (bestRefMat) bestRefMat.delete();
              if (bestKp2) bestKp2.delete();
              if (bestMatches) bestMatches.delete();

              bestScore = goodMatches.length;
              bestMatch = region.name;
              bestRefMat = refMat.clone();
              bestKp2 = kp2.clone();
              
              bestMatches = new cv.DMatchVector();
              for (let i = 0; i < goodMatches.length; i++) {
                bestMatches.push_back(goodMatches[i]);
              }
              
              refMat = null; // Prevent deletion
            }
          }
        } finally {
          if (desc2) desc2.delete();
          if (kp2 && kp2 !== bestKp2) kp2.delete();
          if (refMat) refMat.delete();
        }
      }
    }

    if (bestMatch) {
      return {
        name: bestMatch,
        matchCount: bestScore,
        keypoints1: kp1,
        keypoints2: bestKp2,
        matches: bestMatches,
        roiMat: maskedColor.clone(), // Return the masked color ROI
        matchedRefImage: bestRefMat,
      };
    }
    return null;
  } finally {
    // Clean up if we didn't return a result
    maskedColor.delete();
    if (!bestMatch) {
      kp1.delete();
      desc1.delete();
      if (bestRefMat) bestRefMat.delete();
      if (bestKp2) bestKp2.delete();
      if (bestMatches) bestMatches.delete();
    }
  }
};

  
  // function detectFingertipFromContours(imageData, width, height) {
  //   try {
  //     const src = cv.matFromImageData(imageData);

  //     // 1. Convert to grayscale
  //     const gray = new cv.Mat();
  //     cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);

  //     // 2. Gaussian blur
  //     const blurred = new cv.Mat();
  //     cv.GaussianBlur(gray, blurred, new cv.Size(5, 5), 0);

  //     // 3. Thresholding
  //     const thresh = new cv.Mat();
  //     cv.threshold(
  //       blurred,
  //       thresh,
  //       60,
  //       255,
  //       cv.THRESH_BINARY_INV + cv.THRESH_OTSU
  //     );

  //     // 4. Find contours
  //     const contours = new cv.MatVector();
  //     const hierarchy = new cv.Mat();
  //     cv.findContours(
  //       thresh,
  //       contours,
  //       hierarchy,
  //       cv.RETR_EXTERNAL,
  //       cv.CHAIN_APPROX_SIMPLE
  //     );

  //     let fingertip = null;

  //     if (contours.size() > 0) {
  //       let largestContour = contours.get(0);
  //       let maxArea = cv.contourArea(largestContour);

  //       for (let i = 1; i < contours.size(); i++) {
  //         const contour = contours.get(i);
  //         const area = cv.contourArea(contour);
  //         if (area > maxArea) {
  //           largestContour = contour;
  //           maxArea = area;
  //         }
  //       }

  //       // 5. Approximate the contour
  //       const approx = new cv.Mat();
  //       const peri = cv.arcLength(largestContour, true);
  //       cv.approxPolyDP(largestContour, approx, 0.01 * peri, true);

  //       // 6. Find the topmost point (minimum Y value)
  //       let topMost = { x: 0, y: height };
  //       for (let i = 0; i < approx.rows; i++) {
  //         const point = approx.intPtr(i);
  //         const x = point[0];
  //         const y = point[1];
  //         if (y < topMost.y) {
  //           topMost = { x, y };
  //         }
  //       }

  //       // Optional boundary check
  //       if (topMost.y < height - 5 && topMost.y > 5) {
  //         fingertip = topMost;
  //       }

  //       approx.delete();
  //     }

  //     // Cleanup
  //     src.delete();
  //     gray.delete();
  //     blurred.delete();
  //     thresh.delete();
  //     contours.delete();
  //     hierarchy.delete();

  //     return fingertip;
  //   } catch (err) {
  //     console.error("Error in contour fingertip detection:", err);
  //     return null;
  //   }
  // }

  useEffect(() => {
    const startCamera = async () => {
      let stream = null;
      let constraints = { video: { facingMode: { exact: "environment" } } };

      try {
        stream = await navigator.mediaDevices.getUserMedia(constraints);
      } catch (err) {
        constraints.video.facingMode = { ideal: "environment" };
        try {
          stream = await navigator.mediaDevices.getUserMedia(constraints);
        } catch (err2) {
          stream = await navigator.mediaDevices.getUserMedia({ video: true });
        }
      }

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }

      return new Promise((resolve) => {
        videoRef.current.onloadedmetadata = () => {
          resolve(videoRef.current);
        };
      });
    };

    startCamera().then(() => {
      const hands = new Hands({
        locateFile: (file) =>
          `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`,
      });

      hands.setOptions({
        maxNumHands: 1,
        modelComplexity: 0,
        minDetectionConfidence: 0.6,
        minTrackingConfidence: 0.5,
      });

      handsRef.current = hands;

      hands.onResults((results) => {
        let fingerTip = null;

        if (pointerRef.current) {
          pointerRef.current.style.display = "none";
        }

        const canvas = canvasRef.current;
        const video = videoRef.current;

        // 1️⃣ Try MediaPipe hand detection
        if (
          results.multiHandLandmarks &&
          results.multiHandLandmarks.length > 0
        ) {
          const indexTip = results.multiHandLandmarks[0][8];
          if (canvas) {
            fingerTip = {
              x: indexTip.x * canvas.width,
              y: indexTip.y * canvas.height,
            };
            handDetectionFailCount.current = 0;
            setDetectionMode("hand");
            setWarningMessage("Hand detected");
            setIsDetected(true);
          }
        } 
        // else {
        //   // 2️⃣ Try fallback fingertip detection from contour
        //   handDetectionFailCount.current++;
        //   if (handDetectionFailCount.current > 2 && canvas && video) {
        //     setDetectionMode("fingertip");
        //     setWarningMessage("Trying fingertip detection...");

        //     const ctx = canvas.getContext("2d");
        //     ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        //     const imageData = ctx.getImageData(
        //       0,
        //       0,
        //       canvas.width,
        //       canvas.height
        //     );
        //     const detectedTip = detectFingertipFromContours(
        //       imageData,
        //       canvas.width,
        //       canvas.height
        //     ); // <-- Implement this separately

        //     if (detectedTip) {
        //       fingerTip = detectedTip;
        //       setWarningMessage("Fingertip detected");
        //       setIsDetected(true);
        //     } else {
        //       setWarningMessage("No hand/finger detected");
        //       setIsDetected(false);
        //     }
        //   } else {
        //     setWarningMessage("Show your hand to the camera");
        //     setIsDetected(false);
        //   }
        // }

        // 📍 Show pointer
        if (fingerTip && pointerRef.current) {
          pointerRef.current.style.display = "block";
          pointerRef.current.style.left = `${fingerTip.x}px`;
          pointerRef.current.style.top = `${fingerTip.y}px`;
        }

        // ⏱ Trigger auto capture
        if (fingerTip && !handDetectionTimer.current) {
          handDetectionTimer.current = setTimeout(() => {
            handleCapture(fingerTip);
            handDetectionTimer.current = null;
          }, 2000);
        }

        // ❌ Clear timer if no detection
        if (!fingerTip && handDetectionTimer.current) {
          clearTimeout(handDetectionTimer.current);
          handDetectionTimer.current = null;
        }
      });

      const detectLoop = async () => {
        const video = videoRef.current;
        const canvas = canvasRef.current;
        if (!video || !canvas) return;

        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

        await handsRef.current.send({ image: video });
        requestAnimationFrame(detectLoop);
      };

      const scaleContainer = () => {
        const wrapper = containerRef.current?.parentElement;
        if (!wrapper || !containerRef.current) return;

        const scaleX = wrapper.clientWidth / wrapper.clientHeight;
        const scaleY = 1;
        containerRef.current.style.transform = `scale(${scaleX}, ${scaleY})`;
      };

      //   scaleContainer();
      //   window.addEventListener("resize", scaleContainer);
      detectLoop();
    });

    return () => {
      if (handsRef.current) {
        handsRef.current.close();
      }
    };
  }, []);

// Updated handleCapture function
const handleCapture = async (fingerTip) => {
  const canvas = canvasRef.current;
  const video = videoRef.current;
  if (!canvas || !video) return;

  try {
    setIsProcessing(true);
    setErrorDetails(null);

    const ctx = canvas.getContext("2d");
    const { width, height } = canvas;

    ctx.drawImage(video, 0, 0, width, height);
    const fullImageData = ctx.getImageData(0, 0, width, height);

    if (!window.cv?.matFromImageData) {
      throw new Error("OpenCV not loaded properly");
    }

    const capturedMat = window.cv.matFromImageData(fullImageData);

    let pointerX = fingerTip?.x;
    let pointerY = fingerTip?.y;

    if (!pointerX || !pointerY) {
      if (!pointerRef.current) {
        throw new Error("Pointer position not detected");
      }
      pointerX = parseInt(pointerRef.current.style.left, 10);
      pointerY = parseInt(pointerRef.current.style.top, 10);
    }

    if (isNaN(pointerX) || isNaN(pointerY)) {
      throw new Error(`Invalid pointer position: X=${pointerX}, Y=${pointerY}`);
    }

    const result = await compareWithReferenceImages(
      capturedMat,
      pointerX,
      pointerY
    );

    capturedMat.delete();

    if (result?.name) {
      alert(`✅ Detected: ${result.name}`);
      
      try {
        const debugContainer = document.getElementById("match-debug-container");
        debugContainer.innerHTML = ''; // Clear previous results
        
        const debugCanvas = document.createElement("canvas");
        const debugCtx = debugCanvas.getContext("2d");
        
        // Determine image dimensions
        const roiWidth = result.roiMat.cols;
        const roiHeight = result.roiMat.rows;
        const refWidth = result.matchedRefImage.cols;
        const refHeight = result.matchedRefImage.rows;
        
        debugCanvas.width = roiWidth + refWidth;
        debugCanvas.height = Math.max(roiHeight, refHeight);
        
        // Convert ROI to display format
        let roiDisplay;
        if (result.roiMat.type() === cv.CV_8UC1) {
          roiDisplay = new cv.Mat();
          cv.cvtColor(result.roiMat, roiDisplay, cv.COLOR_GRAY2RGBA);
        } else {
          roiDisplay = result.roiMat.clone();
        }
        
        // Convert reference to display format
        let refDisplay;
        if (result.matchedRefImage.type() === cv.CV_8UC1) {
          refDisplay = new cv.Mat();
          cv.cvtColor(result.matchedRefImage, refDisplay, cv.COLOR_GRAY2RGBA);
        } else {
          refDisplay = result.matchedRefImage.clone();
        }
        
        // Draw ROI (left side)
        const roiImgData = new ImageData(
          new Uint8ClampedArray(roiDisplay.data),
          roiWidth,
          roiHeight
        );
        debugCtx.putImageData(roiImgData, 0, 0);
        
        // Draw reference (right side)
        const refImgData = new ImageData(
          new Uint8ClampedArray(refDisplay.data),
          refWidth,
          refHeight
        );
        debugCtx.putImageData(refImgData, roiWidth, 0);
        
        // Draw match lines if we have valid data
        if (result.keypoints1 && result.keypoints2 && result.matches) {
          drawMatchLinesManual(
            debugCtx,
            result.keypoints1,
            result.keypoints2,
            result.matches,
            roiWidth
          );
        }
        
        // Add canvas to container
        debugCanvas.style.maxWidth = "100%";
        debugCanvas.style.height = "auto";
        debugContainer.appendChild(debugCanvas);
        
        // Cleanup
        roiDisplay.delete();
        refDisplay.delete();
      } catch (visErr) {
        console.error("Visualization error:", visErr);
        setErrorDetails(`Visualization failed: ${visErr.message}`);
      }
    } else {
      alert("❌ No confident match found (try moving closer)");
    }
  } catch (err) {
    const errorMsg = `Detection failed: ${err?.message || 'Unknown error'}`;
    console.error(errorMsg, err);
    setErrorDetails(errorMsg);
    alert("❌ " + errorMsg);
  } finally {
    setIsProcessing(false);
  }
};


  // const handleCapture = async (fingerTip) => {
  //   const canvas = canvasRef.current;
  //   const video = videoRef.current;
  //   if (!canvas || !video) return;

  //   try {
  //     setIsProcessing(true);
  //     setErrorDetails(null);

  //     const ctx = canvas.getContext("2d");
  //     const { width, height } = canvas;

  //     ctx.drawImage(video, 0, 0, width, height);
  //     const fullImageData = ctx.getImageData(0, 0, width, height);

  //     if (!window.cv?.matFromImageData) {
  //       throw new Error("OpenCV not loaded properly");
  //     }

  //     const capturedMat = window.cv.matFromImageData(fullImageData);

  //     let pointerX = fingerTip?.x;
  //     let pointerY = fingerTip?.y;

  //     if (!pointerX || !pointerY) {
  //       if (!pointerRef.current) {
  //         throw new Error("Pointer position not detected");
  //       }

  //       pointerX = parseInt(pointerRef.current.style.left, 10);
  //       pointerY = parseInt(pointerRef.current.style.top, 10);
  //     }

  //     if (isNaN(pointerX) || isNaN(pointerY)) {
  //       throw new Error(
  //         `Invalid pointer position: X=${pointerX}, Y=${pointerY}`
  //       );
  //     }

  //     // const matchedRegion = await compareWithReferenceImages(
  //     //   capturedMat,
  //     //   pointerX,
  //     //   pointerY
  //     // );

  //     const result = await compareWithReferenceImages(
  //       capturedMat,
  //       pointerX,
  //       pointerY
  //     );

  //     capturedMat.delete();

  //     if (result?.name) {
  //       alert(`✅ Detected: ${result.name}`);
  //       // Convert mats to RGBA
  //       const roiRGBA = new cv.Mat();
  //       cv.cvtColor(result.roiMat, roiRGBA, cv.COLOR_GRAY2RGBA);

  //       const refRGBA = new cv.Mat();
  //       cv.cvtColor(result.matchedRefImage, refRGBA, cv.COLOR_GRAY2RGBA);

  //       // Create canvas
  //       const debugCanvas = document.createElement("canvas");
  //       const ctx = debugCanvas.getContext("2d");
  //       debugCanvas.width = roiRGBA.cols + refRGBA.cols;
  //       debugCanvas.height = Math.max(roiRGBA.rows, refRGBA.rows);

  //       // Draw ROI on left
  //       const roiImgData = new ImageData(
  //         new Uint8ClampedArray(roiRGBA.data),
  //         roiRGBA.cols,
  //         roiRGBA.rows
  //       );
  //       ctx.putImageData(roiImgData, 0, 0);

  //       // Draw reference on right
  //       const refImgData = new ImageData(
  //         new Uint8ClampedArray(refRGBA.data),
  //         refRGBA.cols,
  //         refRGBA.rows
  //       );
  //       ctx.putImageData(refImgData, roiRGBA.cols, 0);

  //       // Draw match lines manually
  //       // drawMatchLinesManual(ctx, result.keypoints1, result.keypoints2, result.matches, roiRGBA.cols);
  //       // drawMatchLinesManual(ctx, result.keypoints1Coords, result.keypoints2Coords, result.matches, roiRGBA.cols);
  //       drawMatchLinesManual(
  //         ctx,
  //         result.keypoints1,
  //         result.keypoints2,
  //         result.matches,
  //         roiRGBA.cols
  //       );

  //       // Append canvas to debug container
  //       // document.getElementById("match-debug-container")?.appendChild(debugCanvas);
  //       debugCanvas.style.maxWidth = "100%";
  //       debugCanvas.style.height = "auto";
  //       debugCanvas.style.display = "block";
  //       document
  //         .getElementById("match-debug-container")
  //         ?.appendChild(debugCanvas);

  //       // Cleanup
  //       roiRGBA.delete();
  //       refRGBA.delete();
  //     } else {
  //       alert("❌ No confident match found (try moving closer)");
  //     }

  //     // capturedMat.delete();

  //     // if (matchedRegion) {
  //     //   alert(`✅ Detected: ${matchedRegion}`);
  //     // } else {
  //     //   alert("❌ No confident match found (try moving closer)");
  //     // }
  //   } catch (err) {
  //     const errorMsg = `Detection failed: ${err.message}`;
  //     console.error(errorMsg, err);
  //     setErrorDetails(errorMsg);
  //     alert("❌ " + errorMsg);
  //   } finally {
  //     setIsProcessing(false);
  //   }
  // };

  return (
    <div className="fixed inset-0 flex flex-col items-center justify-center p-4 bg-[#f3e8d4] h-[100dvh]">
      <h1 className="text-2xl font-bold text-[#046a81] mb-4">Hand Detection</h1>

      <div
        className="wrapper relative bg-black overflow-hidden rounded-lg aspect-video"
        style={{
          width: "100vw",
          height: "75vh",
          maxHeight: "75vh",
          maxWidth: "100vw",
        }}
      >
        <div
          id="container"
          ref={containerRef}
          className="absolute inset-0"
          style={{
            width: "100%",
            height: "100%",
            // transformOrigin: "top left",
            transform: "none", // ensure no scale remains
          }}
        >
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-cover"
          />

          <canvas ref={canvasRef} className="absolute inset-0 hidden" />

          <canvas ref={detectionCanvasRef} className="hidden" />

          <div
            ref={pointerRef}
            // className={`absolute w-8 h-8 rounded-full border-2 border-white pointer-events-none hidden transform -translate-x-1/2 -translate-y-1/2 ${
            //   detectionMode === "hand" ? "bg-green-500" : "bg-orange-500"
            // } bg-opacity-70`}
          />
        </div>
      </div>

      <div className="mt-4 w-full">
        {isDetected ? (
          <div className="bg-green-50 border border-green-200 rounded-lg p-3 flex items-center gap-3">
            <div className="w-3 h-3 bg-green-500 rounded-full"></div>
            <div>
              <p className="text-green-800 font-medium text-sm">
                {detectionMode === "hand"
                  ? "Hand detected"
                  : "Fingertip detected"}
              </p>
              <p className="text-green-600 text-xs">
                Current mode: {detectionMode}
              </p>
            </div>
          </div>
        ) : (
          <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 flex items-center gap-3">
            <div className="w-3 h-3 bg-orange-500 rounded-full animate-pulse"></div>
            <div>
              <p className="text-orange-800 font-medium text-sm">
                {warningMessage}
              </p>
              <p className="text-orange-600 text-xs">
                Show your hand or finger to the camera
              </p>
            </div>
          </div>
        )}
      </div>

      {/* <div className="mt-6 w-full max-w-md">
        <button
          onClick={async () => {
            if (!isDetected || !canvasRef.current) return;

            try {
              setIsProcessing(true);
              setErrorDetails(null); // Reset error

              const ctx = canvasRef.current.getContext("2d");
              const { width, height } = canvasRef.current;

              // Add validation
              if (!pointerRef.current) {
                throw new Error("Pointer position not detected");
              }

              const pointerX = parseInt(pointerRef.current.style.left, 10);
              const pointerY = parseInt(pointerRef.current.style.top, 10);

              // Validate pointer position
              if (isNaN(pointerX) || isNaN(pointerY)) {
                throw new Error(
                  `Invalid pointer position: X=${pointerX}, Y=${pointerY}`
                );
              }

              const fullImageData = ctx.getImageData(0, 0, width, height);

              if (!window.cv?.matFromImageData) {
                throw new Error("OpenCV not loaded properly");
              }

              const capturedMat = window.cv.matFromImageData(fullImageData);
              const matchedRegion = await compareWithReferenceImages(
                capturedMat,
                pointerX,
                pointerY
              );

              capturedMat.delete();

              if (matchedRegion) {
                alert(`✅ Detected: ${matchedRegion}`);
              } else {
                alert("❌ No confident match found (try moving closer)");
              }
            } catch (err) {
              const errorMsg = `Detection failed: ${err.message}`;
              console.error(errorMsg, err);
              setErrorDetails(errorMsg);
              alert("❌ " + errorMsg);
            } finally {
              setIsProcessing(false);
            }
          }}
        >
          {isProcessing ? (
            <span className="flex items-center justify-center gap-2">
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              Processing...
            </span>
          ) : (
            "Capture Detection"
          )}
        </button>
        {matchScores.length > 0 && (
          <div className="mt-4 w-full max-w-md text-sm bg-white p-3 rounded-lg shadow">
            <h3 className="font-semibold mb-2 text-[#046a81]">
              📊 Match Scores:
            </h3>
            <ul className="space-y-1">
              {matchScores.map((item, idx) => (
                <li key={idx} className="flex justify-between border-b pb-1">
                  <span>{item.name}</span>
                  <span>{item.score}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div> */}
      <div
        id="match-debug-container"
        className="mt-4 w-full max-w-[90vw] overflow-auto"
      />
    </div>
  );
};

export default SimplePosterSelector;

// import React, { useEffect, useRef, useState } from 'react';
// import { useParams, useNavigate } from 'react-router-dom';

// const SimplePosterSelector = () => {
//   const { qrId } = useParams();
//   const navigate = useNavigate();

//   // Refs
//   const videoRef = useRef(null);
//   const canvasRef = useRef(null);
//   const referenceCanvasRef = useRef([]);

//   // State
//   // Add this to your state declarations
// const [debugInfo, setDebugInfo] = useState({
//     openCVLoaded: false,
//     pointing: false,
//     error: null,
//     matchResults: null,
//     handArea: null
//   });

//   const [posterVerified, setPosterVerified] = useState(false);
//   const [handDetected, setHandDetected] = useState(false);
//   const [capturing, setCapturing] = useState(false);
//   const [warningMessage, setWarningMessage] = useState('Initializing...');
//   const [mode, setMode] = useState('verify-poster');
//   const [referenceImages, setReferenceImages] = useState([
//     { name: 'hurry', path: '/eating-habit/reference/i_eat_in_a_hurry.svg' },
//     { name: 'mindfully', path: '/eating-habit/reference/i_eat_mindfully.svg' },
//     { name: 'distracted', path: '/eating-habit/reference/i_eat_while_distracted.svg' }
//   ]);

//   // Detection tracking
//   const detectionIntervalRef = useRef(null);
//   const captureTimeoutRef = useRef(null);

//   // Valid corner marker IDs
//   const cornerMarkerIds = [2, 13, 6, 3];

//   // Load reference images
//   useEffect(() => {
//     const loadReferenceImages = async () => {
//       const loadedReferences = await Promise.all(
//         referenceImages.map(async (ref) => {
//           const canvas = document.createElement('canvas');
//           const ctx = canvas.getContext('2d');
//           const img = new Image();

//           await new Promise((resolve) => {
//             img.onload = () => {
//               canvas.width = img.width;
//               canvas.height = img.height;
//               ctx.drawImage(img, 0, 0);
//               resolve();
//             };
//             img.src = ref.path;
//           });

//           return { ...ref, canvas };
//         })
//       );

//       referenceCanvasRef.current = loadedReferences;
//     };

//     loadReferenceImages();
//   }, []);

//   // Add the helper function
//   const compareImageSimilarity = (canvas1, canvas2) => {
//     try {
//       const ctx1 = canvas1.getContext('2d');
//       const ctx2 = canvas2.getContext('2d');

//       // Use a larger size for better comparison
//       const size = 64;
//       const tempCanvas1 = document.createElement('canvas');
//       const tempCanvas2 = document.createElement('canvas');
//       tempCanvas1.width = tempCanvas1.height = size;
//       tempCanvas2.width = tempCanvas2.height = size;

//       const tempCtx1 = tempCanvas1.getContext('2d');
//       const tempCtx2 = tempCanvas2.getContext('2d');

//       // Draw resized images with white background
//       tempCtx1.fillStyle = 'white';
//       tempCtx1.fillRect(0, 0, size, size);
//       tempCtx1.drawImage(canvas1, 0, 0, size, size);

//       tempCtx2.fillStyle = 'white';
//       tempCtx2.fillRect(0, 0, size, size);
//       tempCtx2.drawImage(canvas2, 0, 0, size, size);

//       // Get image data
//       const data1 = tempCtx1.getImageData(0, 0, size, size).data;
//       const data2 = tempCtx2.getImageData(0, 0, size, size).data;

//       // Calculate histogram similarity instead of pixel difference
//       const hist1 = calculateColorHistogram(data1);
//       const hist2 = calculateColorHistogram(data2);

//       return compareHistograms(hist1, hist2);
//     } catch (error) {
//       throw new Error(`Image comparison failed: ${error.message}`);
//     }
//   };

//   const calculateColorHistogram = (data) => {
//     const hist = { r: new Array(8).fill(0), g: new Array(8).fill(0), b: new Array(8).fill(0) };

//     for (let i = 0; i < data.length; i += 4) {
//       const r = Math.floor(data[i] / 32);
//       const g = Math.floor(data[i + 1] / 32);
//       const b = Math.floor(data[i + 2] / 32);

//       hist.r[r]++;
//       hist.g[g]++;
//       hist.b[b]++;
//     }

//     return hist;
//   };

//   const compareHistograms = (hist1, hist2) => {
//     let similarity = 0;
//     let total = 0;

//     for (let i = 0; i < 8; i++) {
//       similarity += Math.min(hist1.r[i], hist2.r[i]);
//       similarity += Math.min(hist1.g[i], hist2.g[i]);
//       similarity += Math.min(hist1.b[i], hist2.b[i]);

//       total += hist1.r[i] + hist1.g[i] + hist1.b[i];
//     }

//     return total > 0 ? similarity / total : 0;
//   };

// //   const compareImageSimilarity = (canvas1, canvas2) => {
// //     try {
// //       const ctx1 = canvas1.getContext('2d');
// //       const ctx2 = canvas2.getContext('2d');

// //       // Resize both to same size for comparison
// //       const size = 64; // Small size for faster comparison
// //       const tempCanvas1 = document.createElement('canvas');
// //       const tempCanvas2 = document.createElement('canvas');
// //       tempCanvas1.width = tempCanvas1.height = size;
// //       tempCanvas2.width = tempCanvas2.height = size;

// //       const tempCtx1 = tempCanvas1.getContext('2d');
// //       const tempCtx2 = tempCanvas2.getContext('2d');

// //       // Draw resized images
// //       tempCtx1.drawImage(canvas1, 0, 0, size, size);
// //       tempCtx2.drawImage(canvas2, 0, 0, size, size);

// //       // Get image data
// //       const data1 = tempCtx1.getImageData(0, 0, size, size).data;
// //       const data2 = tempCtx2.getImageData(0, 0, size, size).data;

// //       // Calculate similarity using normalized cross-correlation
// //       let sum1 = 0, sum2 = 0, sum1Sq = 0, sum2Sq = 0, pSum = 0;
// //       const len = data1.length;

// //       for (let i = 0; i < len; i += 4) { // Skip alpha channel
// //         const r1 = data1[i], g1 = data1[i + 1], b1 = data1[i + 2];
// //         const r2 = data2[i], g2 = data2[i + 1], b2 = data2[i + 2];

// //         // Convert to grayscale
// //         const gray1 = 0.299 * r1 + 0.587 * g1 + 0.114 * b1;
// //         const gray2 = 0.299 * r2 + 0.587 * g2 + 0.114 * b2;

// //         sum1 += gray1;
// //         sum2 += gray2;
// //         sum1Sq += gray1 * gray1;
// //         sum2Sq += gray2 * gray2;
// //         pSum += gray1 * gray2;
// //       }

// //       const n = len / 4;
// //       const num = pSum - (sum1 * sum2 / n);
// //       const den = Math.sqrt((sum1Sq - sum1 * sum1 / n) * (sum2Sq - sum2 * sum2 / n));

// //       return den === 0 ? 0 : num / den;
// //     } catch (error) {
// //       console.error('Image comparison error:', error);
// //       return 0;
// //     }
// //   };

//   // Initialize camera
//   useEffect(() => {
//     initializeCamera();
//     return () => {
//       if (videoRef.current?.srcObject) {
//         const tracks = videoRef.current.srcObject.getTracks();
//         tracks.forEach(track => track.stop());
//       }
//       clearDetectionInterval();
//     };
//   }, []);

//   // Handle mode changes
//   useEffect(() => {
//     if (mode === 'verify-poster') {
//       startPosterVerification();
//     } else if (mode === 'detect-zone') {
//       startZoneDetection();
//     }
//   }, [mode]);

//   const clearDetectionInterval = () => {
//     if (detectionIntervalRef.current) {
//       clearInterval(detectionIntervalRef.current);
//       detectionIntervalRef.current = null;
//     }
//   };

//   const initializeCamera = async () => {
//     try {
//       const stream = await navigator.mediaDevices.getUserMedia({
//         video: { facingMode: { ideal: 'environment' } }
//       });
//       if (videoRef.current) {
//         videoRef.current.srcObject = stream;
//         videoRef.current.onloadedmetadata = async () => {
//           await videoRef.current.play();
//           setWarningMessage('Show full poster to verify');
//           setMode('verify-poster');
//         };
//       }
//     } catch (error) {
//       console.error('Camera failed:', error);
//       setWarningMessage('Camera access denied');
//     }
//   };

//   const startPosterVerification = () => {
//     clearDetectionInterval();

//     detectionIntervalRef.current = setInterval(() => {
//       if (!videoRef.current || !canvasRef.current || posterVerified) return;

//       const video = videoRef.current;
//       const canvas = canvasRef.current;

//       if (video.readyState !== 4) return;

//       try {
//         const ctx = canvas.getContext('2d');
//         canvas.width = video.videoWidth;
//         canvas.height = video.videoHeight;
//         ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

//         if (!window.AR || !window.AR.Detector) {
//           console.warn('ArUco library not loaded');
//           return;
//         }

//         const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
//         const detector = new window.AR.Detector();
//         const markers = detector.detect(imageData);

//         // Check if all corner markers are detected
//         const foundIds = markers.map(m => m.id);
//         const allCornersDetected = cornerMarkerIds.every(id => foundIds.includes(id));

//         if (allCornersDetected) {
//           setPosterVerified(true);
//           setWarningMessage('Poster verified! Now point camera at one zone');
//           setMode('detect-zone');
//           clearDetectionInterval();
//         }
//       } catch (error) {
//         console.error('ArUco detection error:', error);
//       }
//     }, 300);
//   };

//   const startZoneDetection = () => {
//     clearDetectionInterval();

//     detectionIntervalRef.current = setInterval(() => {
//       if (!videoRef.current || !canvasRef.current || !posterVerified) return;

//       const video = videoRef.current;
//       const canvas = canvasRef.current;

//       if (video.readyState !== 4) return;

//       try {
//         const ctx = canvas.getContext('2d');
//         canvas.width = video.videoWidth;
//         canvas.height = video.videoHeight;
//         ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

//         // Detect hand pointing and get the area being pointed at
//         const pointingInfo = detectHandPointingArea(canvas);
//         setHandDetected(pointingInfo.pointing);

//         if (pointingInfo.pointing && pointingInfo.pointingArea) {
//           setWarningMessage('Pointing detected! Hold steady to capture...');

//           // Draw debug overlay to show pointing area
//           if (canvas.getContext) {
//             const debugCtx = canvas.getContext('2d');
//             debugCtx.strokeStyle = 'red';
//             debugCtx.lineWidth = 3;
//             debugCtx.strokeRect(
//               pointingInfo.pointingArea.x,
//               pointingInfo.pointingArea.y,
//               pointingInfo.pointingArea.width,
//               pointingInfo.pointingArea.height
//             );

//             // Draw finger tip
//             debugCtx.fillStyle = 'red';
//             debugCtx.beginPath();
//             debugCtx.arc(pointingInfo.fingerTip.x, pointingInfo.fingerTip.y, 8, 0, 2 * Math.PI);
//             debugCtx.fill();
//           }

//           if (!capturing) {
//             startCapture(pointingInfo.pointingArea);
//           }
//         } else {
//           setWarningMessage('Move close to a region and point at it with your finger');
//         }
//       } catch (error) {
//         console.error('Zone detection error:', error);
//       }
//     }, 200); // Faster detection for better responsiveness
//   };

//   const detectHandPointingArea = (canvas) => {
//     if (!window.cv) {
//       setDebugInfo(prev => ({ ...prev, openCVLoaded: false, error: 'OpenCV not loaded' }));
//       return { pointing: false, pointingArea: null };
//     }

//     try {
//       const src = window.cv.imread(canvas);
//       const hsv = new window.cv.Mat();
//       const mask = new window.cv.Mat();
//       const contours = new window.cv.MatVector();
//       const hierarchy = new window.cv.Mat();

//       // Convert to HSV
//       window.cv.cvtColor(src, hsv, window.cv.COLOR_RGB2HSV);

//       // Broader skin color range for better detection
//       const lower = new window.cv.Mat(hsv.rows, hsv.cols, hsv.type(), [0, 48, 80, 0]);
//       const upper = new window.cv.Mat(hsv.rows, hsv.cols, hsv.type(), [20, 255, 255, 255]);
//       window.cv.inRange(hsv, lower, upper, mask);

//       // Clean up the mask
//       const kernel = window.cv.getStructuringElement(window.cv.MORPH_ELLIPSE, new window.cv.Size(5, 5));
//       window.cv.morphologyEx(mask, mask, window.cv.MORPH_OPEN, kernel);
//       window.cv.morphologyEx(mask, mask, window.cv.MORPH_CLOSE, kernel);

//       // Find contours
//       window.cv.findContours(mask, contours, hierarchy, window.cv.RETR_EXTERNAL, window.cv.CHAIN_APPROX_SIMPLE);

//       let result = { pointing: false, pointingArea: null };
//       let largestArea = 0;
//       let bestContour = null;

//       // Find the largest contour (likely the hand)
//       for (let i = 0; i < contours.size(); i++) {
//         const contour = contours.get(i);
//         const area = window.cv.contourArea(contour);

//         if (area > 1500 && area > largestArea) {
//           largestArea = area;
//           bestContour = contour;
//         }
//       }

//       if (bestContour) {
//         // Get bounding rectangle of the hand
//         const boundingRect = window.cv.boundingRect(bestContour);

//         // Simple approach: use the center-top of the hand as pointing area
//         const centerX = boundingRect.x + boundingRect.width / 2;
//         const topY = boundingRect.y;

//         // Create crop area around the estimated pointing location
//         const cropSize = 120;
//         const cropArea = {
//           x: Math.max(0, centerX - cropSize / 2),
//           y: Math.max(0, topY - cropSize / 2),
//           width: Math.min(cropSize, canvas.width - (centerX - cropSize / 2)),
//           height: Math.min(cropSize, canvas.height - (topY - cropSize / 2))
//         };

//         result = {
//           pointing: true,
//           pointingArea: cropArea,
//           fingerTip: { x: centerX, y: topY },
//           handArea: largestArea
//         };

//         // Update debug info
//         setDebugInfo(prev => ({
//           ...prev,
//           openCVLoaded: true,
//           pointing: true,
//           handArea: largestArea,
//           error: null
//         }));
//       } else {
//         setDebugInfo(prev => ({
//           ...prev,
//           openCVLoaded: true,
//           pointing: false,
//           handArea: 0,
//           error: 'No hand contour found'
//         }));
//       }

//       // Cleanup
//       src.delete();
//       hsv.delete();
//       mask.delete();
//       contours.delete();
//       hierarchy.delete();
//       kernel.delete();
//       lower.delete();
//       upper.delete();

//       return result;
//     } catch (error) {
//       setDebugInfo(prev => ({
//         ...prev,
//         error: `Detection error: ${error.message}`
//       }));
//       return { pointing: false, pointingArea: null };
//     }
//   };

//   const startCapture = (pointingArea) => {
//     if (captureTimeoutRef.current || capturing) return;

//     setCapturing(true);
//     setWarningMessage('Capturing pointed region...');

//     captureTimeoutRef.current = setTimeout(() => {
//       captureAndCompareRegion(pointingArea);
//       captureTimeoutRef.current = null;
//     }, 1500); // Shorter delay for better UX
//   };

//   const captureAndCompareRegion = (pointingArea) => {
//     if (!canvasRef.current) {
//       setDebugInfo(prev => ({ ...prev, error: 'No canvas available' }));
//       return;
//     }

//     const canvas = canvasRef.current;
//     const ctx = canvas.getContext('2d');

//     try {
//       setDebugInfo(prev => ({ ...prev, error: 'Starting capture...' }));

//       // Crop the pointed area from the canvas
//       const croppedImageData = ctx.getImageData(
//         Math.floor(pointingArea.x),
//         Math.floor(pointingArea.y),
//         Math.floor(pointingArea.width),
//         Math.floor(pointingArea.height)
//       );

//       // Analyze the dominant color in the cropped region
//       const dominantColor = getDominantColor(croppedImageData.data);
//       const matchResults = matchByColor(dominantColor);

//       // Update debug info with results
//       setDebugInfo(prev => ({
//         ...prev,
//         matchResults: matchResults,
//         error: `Dominant color: ${dominantColor}`
//       }));

//       const bestMatch = matchResults.reduce((prev, current) =>
//         (prev.score > current.score) ? prev : current, { name: 'unknown', score: 0 });

//       if (bestMatch.score > 0.4) {
//         setWarningMessage(`Selected: ${bestMatch.name} (${(bestMatch.score * 100).toFixed(1)}% match)`);

//         setTimeout(() => {
//           navigate(`/result?qrId=${qrId}&region=${bestMatch.name}`);
//         }, 2000);
//       } else {
//         setWarningMessage(`No clear match. Best: ${bestMatch.name} (${(bestMatch.score * 100).toFixed(1)}%)`);
//         setTimeout(() => {
//           setCapturing(false);
//           setWarningMessage('Try pointing more clearly at a region');
//         }, 2000);
//       }
//     } catch (error) {
//       setDebugInfo(prev => ({
//         ...prev,
//         error: `Capture error: ${error.message}`
//       }));
//       setWarningMessage('Error processing image. Try again.');
//       setCapturing(false);
//     }
//   };

//   const getDominantColor = (data) => {
//     const colorCounts = {};
//     let maxCount = 0;
//     let dominantColor = '';

//     for (let i = 0; i < data.length; i += 16) { // Sample every 4th pixel
//       const r = data[i];
//       const g = data[i + 1];
//       const b = data[i + 2];

//       // Skip very light colors (likely background)
//       if (r > 240 && g > 240 && b > 240) continue;

//       // Quantize color to reduce noise
//       const qR = Math.floor(r / 40) * 40;
//       const qG = Math.floor(g / 40) * 40;
//       const qB = Math.floor(b / 40) * 40;
//       const key = `${qR},${qG},${qB}`;

//       colorCounts[key] = (colorCounts[key] || 0) + 1;

//       if (colorCounts[key] > maxCount) {
//         maxCount = colorCounts[key];
//         dominantColor = key;
//       }
//     }

//     return dominantColor;
//   };

//   const matchByColor = (dominantColor) => {
//     // Define color profiles for each region - you'll need to adjust these based on your actual SVG colors
//     const colorProfiles = {
//       hurry: [
//         '200,80,80',   // Red-ish colors
//         '240,120,80',  // Orange-ish colors
//         '200,100,100'  // Warm colors
//       ],
//       mindfully: [
//         '80,200,120',  // Green-ish colors
//         '100,180,140', // Light green colors
//         '60,160,100'   // Dark green colors
//       ],
//       distracted: [
//         '80,120,200',  // Blue-ish colors
//         '120,140,220', // Light blue colors
//         '100,100,180'  // Purple-ish colors
//       ]
//     };

//     const results = [];

//     Object.entries(colorProfiles).forEach(([name, colors]) => {
//       let bestScore = 0;

//       colors.forEach(refColor => {
//         const score = calculateColorSimilarity(dominantColor, refColor);
//         if (score > bestScore) {
//           bestScore = score;
//         }
//       });

//       results.push({ name, score: bestScore });
//     });

//     return results;
//   };

//   const calculateColorSimilarity = (color1, color2) => {
//     if (!color1 || !color2) return 0;

//     const [r1, g1, b1] = color1.split(',').map(Number);
//     const [r2, g2, b2] = color2.split(',').map(Number);

//     const distance = Math.sqrt(
//       Math.pow(r1 - r2, 2) +
//       Math.pow(g1 - g2, 2) +
//       Math.pow(b1 - b2, 2)
//     );

//     // Convert distance to similarity (0-1 scale)
//     const maxDistance = Math.sqrt(3 * Math.pow(255, 2));
//     return Math.max(0, 1 - distance / maxDistance);
//   };

//   const handleReset = () => {
//     setPosterVerified(false);
//     setHandDetected(false);
//     setCapturing(false);
//     setWarningMessage('Show full poster to verify');
//     setMode('verify-poster');

//     if (captureTimeoutRef.current) {
//       clearTimeout(captureTimeoutRef.current);
//       captureTimeoutRef.current = null;
//     }
//   };

//   return (
//     <div className="flex flex-col items-center p-4 max-w-md mx-auto bg-[#f3e8d4] min-h-[100dvh]">
//       <h1 className="text-2xl font-bold text-[#046a81] mb-4">Zone Selector</h1>

//       {qrId && (
//         <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
//           <p className="text-blue-800 font-medium">QR ID: {qrId}</p>
//         </div>
//       )}

//       <div className="relative w-full mb-4" style={{ height: '400px' }}>
//         <video
//           ref={videoRef}
//           playsInline
//           autoPlay
//           muted
//           style={{ display: 'none' }}
//         />

//         <canvas
//           ref={canvasRef}
//           className="w-full h-full object-contain rounded-lg border-2 border-gray-300 shadow-md"
//         />

//         <div className="absolute bottom-2 left-2 right-2 flex justify-center">
//           <div className="bg-black bg-opacity-70 text-white px-3 py-1 rounded-full text-sm text-center">
//             {warningMessage}
//           </div>
//         </div>

// {/* Enhanced Debug Panel */}
// <div className="absolute top-2 left-2 bg-black bg-opacity-80 text-white p-2 rounded text-xs max-w-xs">
//   <div className="mb-1">OpenCV: {debugInfo.openCVLoaded ? '✅' : '❌'}</div>
//   <div className="mb-1">Hand: {debugInfo.pointing ? '✅' : '❌'}</div>
//   <div className="mb-1">Refs: {referenceCanvasRef.current?.length || 0}/3</div>
//   {debugInfo.handArea && (
//     <div className="mb-1">Area: {debugInfo.handArea}</div>
//   )}
//   {debugInfo.error && (
//     <div className="mb-1 text-yellow-300">Status: {debugInfo.error}</div>
//   )}
//   {debugInfo.matchResults && (
//     <div className="mb-1">
//       <div>Matches:</div>
//       {debugInfo.matchResults.map(result => (
//         <div key={result.name} className="ml-2">
//           {result.name}: {(result.score * 100).toFixed(1)}%
//         </div>
//       ))}
//     </div>
//   )}
// </div>

//         {mode === 'detect-zone' && (
//           <div className="absolute top-2 right-2">
//             <div className="px-2 py-1 rounded text-xs font-medium bg-green-500 text-white">
//               Zone Detection Active
//             </div>
//           </div>
//         )}
//       </div>

//       <div className="w-full mb-4">
//         {mode === 'verify-poster' ? (
//           <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex items-center gap-3">
//             <div className="w-3 h-3 bg-blue-500 rounded-full animate-pulse"></div>
//             <div>
//               <p className="text-blue-800 font-medium text-sm">Verifying poster...</p>
//               <p className="text-blue-600 text-xs">Show full poster with all markers</p>
//             </div>
//           </div>
//         ) : (
//           <div className={`p-3 rounded-lg border flex items-center gap-3 ${
//             handDetected
//               ? 'bg-green-50 border-green-200'
//               : 'bg-orange-50 border-orange-200'
//           }`}>
//             <div className={`w-3 h-3 rounded-full ${
//               handDetected ? 'bg-green-500' : 'bg-orange-500 animate-pulse'
//             }`}></div>
//             <div>
//               <p className={`font-medium text-sm ${
//                 handDetected ? 'text-green-800' : 'text-orange-800'
//               }`}>
//                 {handDetected ? 'Ready to capture' : 'Point camera at zone'}
//               </p>
//               <p className={`text-xs ${
//                 handDetected ? 'text-green-600' : 'text-orange-600'
//               }`}>
//                 {handDetected ? 'Hold steady...' : 'Show your hand in the zone'}
//               </p>
//             </div>
//           </div>
//         )}
//       </div>

//       <button
//         onClick={handleReset}
//         className="w-full px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-medium transition-colors"
//       >
//         Reset
//       </button>
//     </div>
//   );
// };

// export default SimplePosterSelector;
