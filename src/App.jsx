import { useState } from "react";
// import BMIPointerWithAruco from './components/BMIPointerWithAruco';
// import BMIPointerRobust from './components/BMIPointerRobust';
// import BMIPointerWithJsAruco from './components/BMIPointerWithJsAruco';
// import BMIPointerWithJsAruco from './components/workingBMI copy'
// import BMIPointerWithJsAruco from './components/BmiUsingHull'
// import MarkerSizeDetectionTest from './components/MarkerSizeDetectionTest'
import BMISelectionApp from "./components/BMISelectionApp copy 2";
// import BMIPointerIntegrated from './components/BMIPointerIntegrated'
import Result from "./components/Result";
// import Result from "./components/Result";
import BMISelectionAppTailwind from "./components/BMISelectionAppTailwind";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import PosterScanner from "./components/PosterScanner";
import SimplePosterSelector from "./components/SimplePosterSelector";
// import SimplePosterSelector from "./components/New"; //crops image and gives best match
import ARPosterSelector from "./components/MindArThree";
// import ARPosterSelector from "./components/TemplateMatching";
// import "./App.css";
// import BMISelectionAppTailwind from "./components/BMISelectionAppTailwind";
import HandPointerDetector from "./components/HandPointerMind";
import ObjectRegionDetection from "./components/ObjectRegionDetection"
import ARPosterDisturbance from "./components/RegionDisturbanceDetector";
import FingertipDetector from "./components/RoboflowFingertipDetector";

function App() {
  const handlePointing = (isPointing) => {
    console.log("👉 Pointing gesture detected?", isPointing);
  };
  return (
    <>
      <BrowserRouter basename="/eating-habit">
        <Routes>
          <Route path="/selection/result" element={<Result />} />
          {/* <Route path="/" element={<BMISelectionAppTailwind />}/> */}
          {/* <Route path="/" element={<PosterScanner />} /> */}
          {/* <Route path="/" element={<SimplePosterSelector />} /> v2 */}
          {/* <Route path="/" element={<ARPosterSelector />} />  */}
          <Route
            path="/"
            element={
              <>
                {/* < FingertipDetector /> */}
                <ARPosterSelector />
                {/* <HandPointerDetector onPointingDetected={handlePointing} /> */}
                {/* <ObjectRegionDetection /> */}
        {/* <ARPosterDisturbance/> */}

              </>
            }
          />
        </Routes>
      </BrowserRouter>
    </>
  );
}

export default App;
{
  /* <Route path="/" element={<BMISelectionApp />}/> */
}
{
  /* <Route
          path="/selection/result/"
          element={<Result />}
        /> */
}
