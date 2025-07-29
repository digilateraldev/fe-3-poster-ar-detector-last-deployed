import React from "react";
import { useSearchParams } from "react-router-dom";

const zoneInfo = {
  hurry: { title: "I eat in hurry", videoUrl: "/videos/hurry.mp4" },
  mindfully: { title: "I eat mindfully", videoUrl: "/videos/mindfully.mp4" },
  distracted: {
    title: "I eat while distracted",
    videoUrl: "/videos/distracted.mp4",
  },
};

const VideoPlayerPage = () => {
  const [params] = useSearchParams();
  const zone = params.get("zone");

  if (!zone || !zoneInfo[zone]) return <h2>Invalid zone</h2>;

  return (
    <div
      style={{
        width: "100vw",
        height: "100vh",
        background: "black",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        flexDirection: "column",
      }}
    >
      <h1 style={{ color: "white", marginBottom: "20px" }}>
        {zoneInfo[zone].title}
      </h1>
      <video controls autoPlay style={{ maxWidth: "90%", maxHeight: "80%" }}>
        <source src={zoneInfo[zone].videoUrl} type="video/mp4" />
        Your browser does not support video playback.
      </video>
    </div>
  );
};

export default VideoPlayerPage;
