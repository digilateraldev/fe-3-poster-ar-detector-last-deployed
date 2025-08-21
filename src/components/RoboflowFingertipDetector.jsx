import React, { useState, useRef } from 'react';
import axios from 'axios';

const FingertipDetector = () => {
  const [image, setImage] = useState(null);
  const [predictions, setPredictions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const fileInputRef = useRef(null);
  const canvasRef = useRef(null);

  // Your Roboflow API key and model details
  const API_KEY = 'aZMug7EMp53aBAcNAe9j';
  const MODEL_ENDPOINT = `https://detect.roboflow.com/fingertip-2/1?api_key=${API_KEY}`;

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setImage(event.target.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const detectFingertips = async () => {
    if (!image) return;

    setLoading(true);
    setError(null);

    try {
      // Convert image to the format Roboflow expects
      const base64Image = image.split(',')[1];
      
      const response = await axios.post(
        MODEL_ENDPOINT,
        base64Image,
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        }
      );

      setPredictions(response.data.predictions);
      drawPredictionsOnCanvas(response.data.predictions);
    } catch (err) {
      setError('Failed to detect fingertips. Please try again.');
      console.error('Detection error:', err);
    } finally {
      setLoading(false);
    }
  };

  const drawPredictionsOnCanvas = (predictions) => {
    const canvas = canvasRef.current;
    if (!canvas || !image) return;

    const ctx = canvas.getContext('2d');
    const img = new Image();
    
    img.onload = () => {
      // Set canvas dimensions to match image
      canvas.width = img.width;
      canvas.height = img.height;
      
      // Draw image
      ctx.drawImage(img, 0, 0, img.width, img.height);
      
      // Draw predictions
      predictions.forEach(prediction => {
        const { x, y, width, height, confidence, class: className } = prediction;
        
        // Draw bounding box
        ctx.strokeStyle = '#FF0000';
        ctx.lineWidth = 2;
        ctx.strokeRect(
          x - width / 2,
          y - height / 2,
          width,
          height
        );
        
        // Draw label
        ctx.fillStyle = '#FF0000';
        ctx.font = '16px Arial';
        ctx.fillText(
          `${className} (${(confidence * 100).toFixed(1)}%)`,
          x - width / 2,
          y - height / 2 - 5
        );
      });
    };
    
    img.src = image;
  };

  const triggerFileInput = () => {
    fileInputRef.current.click();
  };

  return (
    <div className="fingertip-detector">
      <h2>Fingertip Detection for Poster Interaction</h2>
      
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleImageUpload}
        accept="image/*"
        style={{ display: 'none' }}
      />
      
      <div className="controls">
        <button onClick={triggerFileInput}>
          {image ? 'Change Image' : 'Upload Image'}
        </button>
        
        {image && (
          <button onClick={detectFingertips} disabled={loading}>
            {loading ? 'Detecting...' : 'Detect Fingertips'}
          </button>
        )}
      </div>
      
      {error && <div className="error">{error}</div>}
      
      <div className="results-container">
        {image && (
          <div className="image-container">
            <canvas ref={canvasRef} style={{ maxWidth: '100%' }} />
          </div>
        )}
        
        {predictions.length > 0 && (
          <div className="predictions">
            <h3>Detection Results:</h3>
            <ul>
              {predictions.map((pred, index) => (
                <li key={index}>
                  {pred.class} - Confidence: {(pred.confidence * 100).toFixed(1)}%
                  <br />
                  Position: ({pred.x.toFixed(0)}, {pred.y.toFixed(0)})
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
      
      <style jsx>{`
        .fingertip-detector {
          max-width: 800px;
          margin: 0 auto;
          padding: 20px;
          font-family: Arial, sans-serif;
        }
        
        .controls {
          margin: 20px 0;
          display: flex;
          gap: 10px;
        }
        
        button {
          padding: 10px 15px;
          background-color: #4CAF50;
          color: white;
          border: none;
          border-radius: 4px;
          cursor: pointer;
        }
        
        button:hover {
          background-color: #45a049;
        }
        
        button:disabled {
          background-color: #cccccc;
          cursor: not-allowed;
        }
        
        .error {
          color: red;
          margin: 10px 0;
        }
        
        .results-container {
          display: flex;
          flex-wrap: wrap;
          gap: 20px;
        }
        
        .image-container {
          flex: 1;
          min-width: 300px;
        }
        
        .predictions {
          flex: 1;
          min-width: 300px;
          background: #f5f5f5;
          padding: 15px;
          border-radius: 4px;
        }
        
        ul {
          list-style-type: none;
          padding: 0;
        }
        
        li {
          margin-bottom: 10px;
          padding: 10px;
          background: white;
          border-radius: 4px;
        }
      `}</style>
    </div>
  );
};

export default FingertipDetector;