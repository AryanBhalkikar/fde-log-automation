import loadPredictedIntervals from "../src/loadPredictedIntervals.js";
import producer from "../src/producer.js";

const compressedSegmentedEvents = loadPredictedIntervals();
producer(compressedSegmentedEvents);
