import { useState } from "react";
// import BMIPointerWithAruco from './components/BMIPointerWithAruco';
// import BMIPointerRobust from './components/BMIPointerRobust';
// import BMIPointerWithJsAruco from './components/BMIPointerWithJsAruco';
// import BMIPointerWithJsAruco from './components/workingBMI copy'
// import BMIPointerWithJsAruco from './components/BmiUsingHull'
// import MarkerSizeDetectionTest from './components/MarkerSizeDetectionTest'
import BMISelectionApp from "./components/BMISelectionApp copy 2";
// import BMIPointerIntegrated from './components/BMIPointerIntegrated'
import VideoPlayerPage from "./components/VideoPlayer";
import SelectionResult from "./components/SelectionResult";

import { BrowserRouter, Route, Routes } from "react-router-dom";

import "./App.css";

function App() {
  return (
    <>
      <BrowserRouter basename="/eating-habit">
        <Routes>
          <Route path="/" element={<BMISelectionApp />}/>
          <Route path="/play" element={<VideoPlayerPage />} />
          <Route path="/selection/result" element={<SelectionResult />} />

        </Routes>
      </BrowserRouter>
    </>
  );
}

export default App;
