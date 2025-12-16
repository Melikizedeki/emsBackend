import express from "express";
import { createEvent, getEvents,getPaymentsByEvent, getEventById, deleteEvent, getTotalEvents} from "../controllers/eventsController.js";

const router = express.Router();

router.post("/events", createEvent);
router.get("/events", getEvents);
router.get("/sum-event", getTotalEventss);
router.get("/events/:id", getEventById);
router.delete("/events/:id", deleteEvent);

router.get("/:eventId", getPaymentsByEvent);


export { router as eventsRouter }; ;













