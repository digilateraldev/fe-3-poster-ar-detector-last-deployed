import React, { useState } from "react";
import MarkerDetectionVisualizer from "./MarkerDetectionVisualizer";
import PosterRegionSelector from "./PosterRegionSelector";
import { useParams } from "react-router-dom";

const PosterScanner = () => {
  const { qrId } = useParams();
  const [posterDetected, setPosterDetected] = useState(false);
  const [scannedPoster, setScannedPoster] = useState(null);

  const handlePosterDetected = (posterImage) => {
    setScannedPoster(posterImage);
    setPosterDetected(true);
  };

  return (
    <div>
      {!posterDetected ? (
        <MarkerDetectionVisualizer onFourMarkersDetected={handlePosterDetected} />
      ) : (
        <PosterRegionSelector qrId={qrId} scannedPoster={scannedPoster} />
      )}
    </div>
  );
};

export default PosterScanner;
