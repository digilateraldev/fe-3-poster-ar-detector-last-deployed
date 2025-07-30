import React from "react";
import { useSearchParams } from "react-router-dom";

const zoneInfo = {
  hurry: {
    title: "I eat in hurry",
    videoUrl: "/videos/hurry.mp4",
  },
  mindfully: {
    title: "I eat mindfully",
    videoUrl: "/videos/mindfully.mp4",
  },
  distracted: {
    title: "I eat while distracted",
    videoUrl: "/videos/distracted.mp4",
  },
};

const SelectionResult = () => {
  const [searchParams] = useSearchParams();
  const qrId = searchParams.get("qrId");
  const region = searchParams.get("region");

  const info = zoneInfo[region];

  useEffect(() => {
    alert(
      `Selection Result Loaded\n\nqrId: ${qrId}\nregion: ${region}\nvideo: ${
        info?.videoUrl || "Not Found"
      }`
    );
  }, [qrId, region]);

  if (!info) return <div>Invalid selection.</div>;

  return (
    <div style={{ padding: "40px", textAlign: "center", color: "#333" }}>
      <h2>{info.title}</h2>
      <p>QR ID: {qrId}</p>
      <video 
      src={info.videoUrl} 
      controls 
      autoPlay 
      muted 
      style={{ maxWidth: "90%", maxHeight: "70vh" }} 
      onError={(e) => alert("Failed to load video. Check video URL.")}
      />
    </div>
  );
};

export default SelectionResult;
