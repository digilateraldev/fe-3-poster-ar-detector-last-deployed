// components/ImageMatcher.js
import React, { useEffect, useRef, useState } from 'react';
import * as tf from '@tensorflow/tfjs';
import * as mobilenet from '@tensorflow-models/mobilenet';

export default function ImageMatcher({ croppedCanvas }) {
  const [model, setModel] = useState(null);
  const [result, setResult] = useState(null);

  const refImages = {
    hurry: '/eating-habit/reference/i_eat_in_a_hurry.png',
    mindfully: '/eating-habit/reference/i_eat_mindfully.png',
    distracted: '/eating-habit/reference/i_eat_while_distracted.png',
  };

  useEffect(() => {
    mobilenet.load().then(setModel);
  }, []);

  const loadImage = (src) => {
    return new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.src = src;
      img.onload = () => resolve(img);
    });
  };

  const getEmbedding = async (image) => {
    const tensor = tf.browser.fromPixels(image).toFloat();
    const resized = tf.image.resizeBilinear(tensor, [224, 224]);
    const expanded = resized.expandDims(0);
    const embedding = model.infer(expanded, true);
    tensor.dispose();
    resized.dispose();
    expanded.dispose();
    return embedding;
  };

  const cosineSimilarity = (a, b) => {
    const dot = tf.sum(tf.mul(a, b));
    const normA = tf.norm(a);
    const normB = tf.norm(b);
    const similarity = dot.div(normA.mul(normB)).dataSync()[0];
    dot.dispose();
    normA.dispose();
    normB.dispose();
    return similarity;
  };

  const matchFromCanvas = async () => {
    if (!croppedCanvas || !model) return;
    const userImg = new Image();
    userImg.src = croppedCanvas.toDataURL('image/jpeg');
    await new Promise((resolve) => (userImg.onload = resolve));

    const userEmbedding = await getEmbedding(userImg);

    let bestMatch = null;
    let bestScore = -Infinity;

    for (const [label, src] of Object.entries(refImages)) {
      const refImg = await loadImage(src);
      const refEmbedding = await getEmbedding(refImg);
      const score = cosineSimilarity(userEmbedding, refEmbedding);
      if (score > bestScore) {
        bestScore = score;
        bestMatch = label;
      }
      refEmbedding.dispose();
    }

    setResult(`${bestMatch} (score: ${bestScore.toFixed(3)})`);
    userEmbedding.dispose();
  };

  useEffect(() => {
    if (croppedCanvas && model) {
      matchFromCanvas();
    }
  }, [croppedCanvas, model]);

  return (
    <div>
      {result && <p>Best match: {result}</p>}
    </div>
  );
}
