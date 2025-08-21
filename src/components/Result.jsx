import { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { FiDownload } from "react-icons/fi";
import { FaSquareCheck } from "react-icons/fa6";
import { apiUtils } from "../utils/deviceId";

const zoneInfo = {
  hurry: {
    title: "I eat in a hurry",
    fileType: "mp4",
    videoUrl: "/videos/hurry.mp4",
  },
  mindfully: {
    title: "I eat mindfully",
    fileType: "mp4",
    videoUrl: "/videos/mindfully.mp4",
  },
  distracted: {
    title: "I eat while distracted",
    fileType: "mp4",
    videoUrl: "/videos/distracted.mp4",
  },
};

const Result = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const qrId = searchParams.get("qrId");
  const region = searchParams.get("region");

  const [data, setData] = useState([]);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false); 

  useEffect(() => {
    if (!qrId || !region) return;
  
    let retries = 0;
    const maxRetries = 3;
  
    const submitSelection = async () => {
      try {
        setLoading(true);
        await apiUtils.post("/selection/store", {
          qrId,
          selection: region,
        });
        console.log("Submission successful");
        setError(null);
      } catch (err) {
        console.error(`Submission failed (attempt ${retries + 1})`, err);
        retries++;
      
        if (retries < maxRetries) {
          console.log("Retrying in 3 seconds...");
          setTimeout(submitSelection, 3000);
        } else {
          const errorMessage = err?.message || JSON.stringify(err) || "Unknown error";
          setError(
            `Failed to submit your response after multiple attempts.\n\nReason: ${errorMessage}`
          );
        }
      }
       finally {
        setLoading(false);
      }
    };
  
    submitSelection();
  }, [qrId, region]);
  
  

  useEffect(() => {
    // Clear URL parameters when component mounts
    const cleanUrl = () => {
      if (window.location.search) {
        window.history.replaceState({}, document.title, window.location.pathname);
      }
    };

    cleanUrl();

    // Set up beforeunload event to clear parameters if user refreshes
    window.addEventListener("beforeunload", cleanUrl);
    
    // Clean up on unmount
    return () => {
      window.removeEventListener("beforeunload", cleanUrl);
      // cleanUrl();
    };
  }, []);



  useEffect(() => {
    if (!region || !zoneInfo[region]) {
      setError("Invalid region selected.");
      return;
    }

    const zone = zoneInfo[region];
    setData([
      {
        title: zone.title.replace(/\s+/g, "_").toLowerCase(),
        fileType: zone.fileType,
        videoUrl: zone.videoUrl,
      },
    ]);
  }, [region]);

  if (loading) {
    return <div className="text-center py-8">Loading data...</div>;
  }

  if (error) {
    return (
      <div className="text-center py-8 text-red-500">Error: {error}</div>
    );
  }

  return (
    <div className="min-h-[100dvh] bg-[#f3e8d4] py-10 px-4">
      <div className="max-w-3xl mx-auto text-center space-y-6">
        {data && data.length > 0 ? (
          <>
            <img
              src="/eating-habit/main-icon.svg"
              alt="Result"
              className="mx-auto w-[350px] h-auto"
            />

            <h2 className="font-semibold text-[#046a81] flex items-center justify-center gap-2">
              <FaSquareCheck className="text-green-600" />
              You have chosen
            </h2>

            <ul className="grid gap-4 md:grid-cols-2 px-2 md:px-6">
              {data.map((detail, index) => (
                <li
                  key={index}
                  className="rounded-lg flex items-center justify-between px-4 space-y-3 hover:shadow-lg transition"
                >
                    <img
                        src={`/eating-habit/${detail.title.toLowerCase().replace(/\s+/g, '_')}.svg`}
                        alt={detail.title}
                        className="w-[40vw] h-auto object-contain"
                    />
                    <div className="flex flex-col justify-center items-center gap-2">
                        <img src={`/eating-habit/${detail.title.toLowerCase().replace(/\s+/g, '_')}-text.svg`} alt="text" className="w-23" />
                        <button
                            onClick={() => {
                                const link = document.createElement('a');
                                link.href = detail.videoUrl;
                                link.download = `${detail.title}.${detail.fileType}`;
                                document.body.appendChild(link);
                                link.click();
                                document.body.removeChild(link);
                            }}
                        className="inline-flex items-center gap-1 px-3 py-1.5 bg-teal-400 hover:bg-teal-600 text-white rounded-md text-sm"
                        >
                            <FiDownload size={16} />
                            <p className="text-xs">Download</p>
                        </button>
                    </div>
                </li>
              ))}
            </ul>
          </>
        ) : (
          <p className="text-gray-600 text-lg">No content available for this region.</p>
        )}
      </div>
    </div>
  );
};

export default Result;

// import { useEffect, useState } from "react";
// import { useSearchParams } from "react-router-dom";
// import { FiDownload } from "react-icons/fi";
// import { FaSquareCheck } from "react-icons/fa6";

// const zoneInfo = {
//   hurry: {
//     title: "I eat in hurry",
//     fileType: "mp4",
//     videoUrl: "/videos/hurry.mp4",
//   },
//   mindfully: {
//     title: "I eat mindfully",
//     fileType: "mp4",
//     videoUrl: "/videos/mindfully.mp4",
//   },
//   distracted: {
//     title: "I eat while distracted",
//     fileType: "mp4",
//     videoUrl: "/videos/distracted.mp4",
//   },
// };

// const Result = () => {
//   const [searchParams] = useSearchParams();
//   const qrId = searchParams.get("qrId");
//   const region = searchParams.get("region");

//   const [data, setData] = useState([]);
//   const [error, setError] = useState(null);

//   useEffect(() => {
//     if (!region || !zoneInfo[region]) {
//       setError("Invalid region selected.");
//       return;
//     }

//     const zone = zoneInfo[region];
//     setData([
//       {
//         title: zone.title.replace(/\s+/g, "_").toLowerCase(),
//         fileType: zone.fileType,
//         videoUrl: zone.videoUrl,
//       },
//     ]);
//   }, [region]);

//   if (error) {
//     return (
//       <div className="text-center py-8 text-red-500 font-semibold">
//         Error: {error}
//       </div>
//     );
//   }

//   return (
//     <div className="container mx-auto px-4 py-8 bg-[#f3e8d4] h-[100dvh]">
//       <div className="border-2 border-[#046a81] flex items-center justify-center mb-4">
//         <h2 className="text-lg font-bold text-[#046a81] uppercase tracking-wide">
//           Patient Education
//         </h2>
//       </div>

//       {data && data.length > 0 ? (
//         <ul className="space-y-3 list-none bg-gray-100 p-2 rounded-lg shadow-sm border border-gray-200">
//           {data.map((detail, index) => (
//             <li
//               key={index}
//               className="flex items-center justify-between rounded-md hover:bg-gray-100 transition-colors duration-200"
//             >
//               <div className="flex items-center space-x-3">
//                 <FaSquareCheck size={20} className="text-teal-600 flex-shrink-0" />
//                 <p className="text-gray-700 font-medium">
//                   {detail.title.split("_").map(word => word.toUpperCase()).join(" ")}
//                 </p>
//               </div>
//               <button
//                 onClick={() => {
//                   const link = document.createElement("a");
//                   link.href = detail.videoUrl;
//                   link.download = `${detail.title}.${detail.fileType}`;
//                   document.body.appendChild(link);
//                   link.click();
//                   document.body.removeChild(link);
//                 }}
//                 className="p-2 bg-orange-500 hover:bg-orange-600 rounded-md text-white transition-colors duration-200 flex items-center justify-center"
//               >
//                 <FiDownload size={16} />
//               </button>
//             </li>
//           ))}
//         </ul>
//       ) : (
//         <p className="text-gray-500">No content available for this region.</p>
//       )}
//     </div>
//   );
// };

// export default Result;
