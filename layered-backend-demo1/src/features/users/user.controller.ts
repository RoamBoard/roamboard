import type { RequestHandler } from "express";

import { getPrototypeUserId } from "./user.auth.js";
import type {
  BoardByIdRequest,
  CreateBoardRequest,
  CreateUserRequest,
  ListBoardsRequest,
  SetProfilePictureRequest,
  UpdateProfileRequest,
} from "./user.schemas.js";
import type { UserService } from "./user.types.js";

export interface UserController {
  createUser: RequestHandler;
  getProfile: RequestHandler;
  updateProfile: RequestHandler;
  setProfilePicture: RequestHandler;
  deleteProfilePicture: RequestHandler;
  getStats: RequestHandler;
  listOwnBoards: RequestHandler;
  listRecentBoards: RequestHandler;
  getBoard: RequestHandler;
  createBoard: RequestHandler;
  saveBoard: RequestHandler;
  unsaveBoard: RequestHandler;
  getMapDestinations: RequestHandler;
}

export function createUserController(service: UserService): UserController {
  const createUser: RequestHandler = async (req, res) => {
    const { body } = req.validated as CreateUserRequest;
    res.status(201).json({ data: await service.createUser(body) });
  };

  const getProfile: RequestHandler = async (req, res) => {
    res.json({ data: await service.getCurrentProfile(getPrototypeUserId(req.prototypeUserId)) });
  };

  const updateProfile: RequestHandler = async (req, res) => {
    const { body } = req.validated as UpdateProfileRequest;
    res.json({ data: await service.updateCurrentProfile(getPrototypeUserId(req.prototypeUserId), body) });
  };

  const setProfilePicture: RequestHandler = async (req, res) => {
    const { body } = req.validated as SetProfilePictureRequest;
    res.json({ data: await service.setProfilePicture(getPrototypeUserId(req.prototypeUserId), body.url, body.storageKey) });
  };

  const deleteProfilePicture: RequestHandler = async (req, res) => {
    res.json({ data: await service.deleteProfilePicture(getPrototypeUserId(req.prototypeUserId)) });
  };

  const getStats: RequestHandler = async (req, res) => {
    res.json({ data: await service.getStats(getPrototypeUserId(req.prototypeUserId)) });
  };

  const listOwnBoards: RequestHandler = async (req, res) => {
    const { query } = req.validated as ListBoardsRequest;
    const boards = await service.getOwnBoards(getPrototypeUserId(req.prototypeUserId), query.limit);
    res.json({ data: boards, meta: { limit: query.limit, count: boards.length } });
  };

  const listRecentBoards: RequestHandler = async (req, res) => {
    const { query } = req.validated as ListBoardsRequest;
    const boards = await service.getRecentBoards(getPrototypeUserId(req.prototypeUserId), query.limit);
    res.json({ data: boards, meta: { limit: query.limit, count: boards.length } });
  };

  const getBoard: RequestHandler = async (req, res) => {
    const { params } = req.validated as BoardByIdRequest;
    res.json({ data: await service.getBoard(getPrototypeUserId(req.prototypeUserId), params.boardId) });
  };

  const createBoard: RequestHandler = async (req, res) => {
    const { body } = req.validated as CreateBoardRequest;
    res.status(201).json({ data: await service.createBoard(getPrototypeUserId(req.prototypeUserId), body) });
  };

  const saveBoard: RequestHandler = async (req, res) => {
    const { params } = req.validated as BoardByIdRequest;
    await service.saveBoard(getPrototypeUserId(req.prototypeUserId), params.boardId);
    res.status(204).send();
  };

  const unsaveBoard: RequestHandler = async (req, res) => {
    const { params } = req.validated as BoardByIdRequest;
    await service.unsaveBoard(getPrototypeUserId(req.prototypeUserId), params.boardId);
    res.status(204).send();
  };

  const getMapDestinations: RequestHandler = async (req, res) => {
    res.json({ data: await service.getMapDestinations(getPrototypeUserId(req.prototypeUserId)) });
  };

  return { createUser, getProfile, updateProfile, setProfilePicture, deleteProfilePicture, getStats, listOwnBoards, listRecentBoards, getBoard, createBoard, saveBoard, unsaveBoard, getMapDestinations };
}
