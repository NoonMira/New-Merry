import { Router } from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import connectionPool from "../utils/db.mjs";

const authRouter = Router();

authRouter.post("/register", async (req, res) => {
  const user = {
    username: req.body.username,
    email: req.body.email,
    password: req.body.password,
    createdAt: new Date(),
  };

  const userProfile = {
    name: req.body.name,
    birthdate: req.body.birthdate,
    location: req.body.location,
    city: req.body.city,
    sexident: req.body.sexident,
    sexprefer: req.body.sexprefer,
    racialprefer: req.body.racialprefer,
    meetprefer: req.body.meetprefer,
  };

  try {
    if ((!user.username && !user.email) || !user.password) {
      return res.status(400).json({
        code: "U002",
        message: "Email or username and password is null",
      });
    }

    const duplicatedUserData = await connectionPool.query(
      `select * from users where username = $1 or email =$2`,
      [user.username, user.email]
    );

    if (duplicatedUserData.rowCount) {
      return res.status(400).json({
        code: "U003",
        message: "Email or username is already used",
      });
    }

    const salt = await bcrypt.genSalt(10);
    // now we set user password to hashed password
    user.password = await bcrypt.hash(user.password, salt);

    const insertID = await connectionPool.query(
      `insert into users (username, email, password, "createdAt") values ($1,$2,$3,$4) returning user_id`,
      [user.username, user.email, user.password, user.createdAt]
    );

    const [{ user_id }] = insertID.rows;

    await connectionPool.query(
      "insert into user_profiles (user_id, name, birthdate, location, city, sexident, sexprefer, racialprefer, meetprefer) values ($1,$2,$3,$4,$5,$6,$7,$8, $9)",
      [
        user_id,
        userProfile.name,
        userProfile.birthdate,
        userProfile.location,
        userProfile.city,
        userProfile.sexident,
        userProfile.sexprefer,
        userProfile.racialprefer,
        userProfile.meetprefer,
      ]
    );

    return res.json({
      code: "U000",
      message: "Register successfully",
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({
      message: "Server could not register because database connection",
    });
  }
});

authRouter.post("/login", async (req, res) => {
  try {
    if (!req.body.username || !req.body.password) {
      return res.status(400).json({
        code: "U002",
        message: "Email or username and password is null",
      });
    }
    const userData = await connectionPool.query(
      "select * from users where username=$1 or email =$1",
      [req.body.username]
    );
    console.log(userData);
    if (!userData.rowCount) {
      return res.status(404).json({
        code: "U001",
        message: "Email or Username and Password is incorrect",
      });
    }

    const user = userData.rows[0];
    const isValidPassword = await bcrypt.compare(
      req.body.password,
      user.password
    );

    if (!isValidPassword) {
      return res.status(404).json({
        code: "U001",
        message: "Email or Username and Password is incorrect",
      });
    }

    if (user.role === "user") {
      const nameData = await connectionPool.query(
        "select name from user_profiles where user_id = $1",
        [user.user_id]
      );
      const [{ name }] = nameData.rows;
      user.name = name;
    }

    //not export user password (hash)
    delete user.password;

    const token = jwt.sign(user, process.env.SECRET_KEY, { expiresIn: 900000 });
    return res.status(201).json({
      code: "U000",
      message: "Login successfully",
      token,
      user,
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({
      message: "Server could not login becasue database connection",
    });
  }
});

export default authRouter;
