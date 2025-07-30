import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { FiDownload } from "react-icons/fi";
import { FaSquareCheck } from "react-icons/fa6";

const zoneInfo = {
  hurry: {
    title: "I eat in hurry",
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
  const qrId = searchParams.get("qrId");
  const region = searchParams.get("region");

  const [data, setData] = useState([]);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false); // Added loading state for consistency

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
    <div className="flex justify-center items-start w-full px-4 py-4 bg-[#f3e8d4] h-[100dvh]">
      {data && data.length > 0 ? (
        <div className="space-y-4 w-full max-w-2xl">
          <div className="border-2 border-[#046a81] flex items-center justify-center py-3">
            <h2 className="text-xl font-bold text-[#046a81] uppercase tracking-wide text-center">
              Patient Education
            </h2>
          </div>
          <ul className="space-y-3 list-none bg-gray-100 p-4 rounded-lg shadow-sm border border-gray-200">
            {data.map((detail, index) => (
              <li
                key={index}
                className="flex items-center justify-between w-full p-3 rounded-md hover:bg-gray-200 transition-colors duration-200"
              >
                <div className="flex items-center space-x-4 flex-1">
                  <FaSquareCheck size={24} className="text-teal-600 flex-shrink-0" />
                  <p className="text-gray-700 font-medium text-base flex-1">
                    {detail.title.split("_").map(word => word.toUpperCase()).join(" ")}
                  </p>
                </div>
                <button
                  onClick={() => {
                    const link = document.createElement("a");
                    link.href = detail.videoUrl;
                    link.download = `${detail.title}.${detail.fileType}`;
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                  }}
                  className="ml-4 p-3 bg-orange-500 hover:bg-orange-600 rounded-md text-white transition-colors duration-200 flex items-center justify-center flex-shrink-0"
                >
                  <FiDownload size={18} />
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="text-gray-500">No content available for this region.</p>
      )}
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
