CREATE TABLE activity_type (
 type VARCHAR(500) NOT NULL
);

ALTER TABLE activity_type ADD CONSTRAINT PK_activity_type PRIMARY KEY (type);


CREATE TABLE app_user (
 user_id VARCHAR(500) NOT NULL,
 username VARCHAR(500) NOT NULL,
 display_name VARCHAR(500) NOT NULL,
 location VARCHAR(500),
 headline VARCHAR(500),
 biography VARCHAR(500),
 occupation VARCHAR(500),
 profile_picture_image_id INT
);

ALTER TABLE app_user ADD CONSTRAINT PK_app_user PRIMARY KEY (user_id);

CREATE TABLE friendship (
 friendship_id INT GENERATED ALWAYS AS IDENTITY NOT NULL,
 status VARCHAR(500) NOT NULL,
    CHECK (status IN ('pending', 'accepted')),
 requester_user_id VARCHAR(500) NOT NULL,
 recipient_user_id VARCHAR(500) NOT NULL,
 CONSTRAINT ck_friendship_distinct_users
    CHECK (requester_user_id <> recipient_user_id)
);

CREATE UNIQUE INDEX uq_friendship_pair
ON friendship (
  (LEAST(requester_user_id, recipient_user_id)),
  (GREATEST(requester_user_id, recipient_user_id))
);

ALTER TABLE friendship ADD CONSTRAINT PK_friendship PRIMARY KEY (friendship_id);


CREATE TABLE language (
 language_name VARCHAR(500) NOT NULL
);

ALTER TABLE language ADD CONSTRAINT PK_language PRIMARY KEY (language_name);


CREATE TABLE Location (
 location_id INT GENERATED ALWAYS AS IDENTITY NOT NULL,
 name VARCHAR(500) NOT NULL,
 latitude DECIMAL(9,6) NOT NULL,
    CHECK (latitude BETWEEN -90 AND 90),
 longitude DECIMAL(9,6) NOT NULL,
    CHECK (longitude BETWEEN -180 AND 180),
 address VARCHAR(500),
 city VARCHAR(500),
 country VARCHAR(500),
 external_place_id VARCHAR(500)
);

ALTER TABLE Location ADD CONSTRAINT PK_Location PRIMARY KEY (location_id);


CREATE TABLE tag (
 tag_id INT GENERATED ALWAYS AS IDENTITY NOT NULL,
 tag_name VARCHAR(500) NOT NULL
);

ALTER TABLE tag ADD CONSTRAINT PK_tag PRIMARY KEY (tag_id);
ALTER TABLE tag ADD CONSTRAINT uq_tag_name UNIQUE (tag_name);

CREATE TABLE uploaded_image (
 uploaded_image_id INT GENERATED ALWAYS AS IDENTITY NOT NULL,
 storage_key VARCHAR(500) NOT NULL,
 uploaded_by_user_id VARCHAR(500) NOT NULL,
 captured_at TIMESTAMP,
 uploaded_at TIMESTAMP NOT NULL
);

ALTER TABLE uploaded_image ADD CONSTRAINT PK_uploaded_image PRIMARY KEY (uploaded_image_id);


CREATE TABLE user_language (
 user_id VARCHAR(500) NOT NULL,
 language_name VARCHAR(500) NOT NULL
);

ALTER TABLE user_language ADD CONSTRAINT PK_user_language PRIMARY KEY (user_id,language_name);


CREATE TABLE user_tag (
 user_id VARCHAR(500) NOT NULL,
 tag_id INT NOT NULL
);

ALTER TABLE user_tag ADD CONSTRAINT PK_user_tag PRIMARY KEY (user_id,tag_id);


CREATE TABLE board (
 board_id INT GENERATED ALWAYS AS IDENTITY NOT NULL,
 owner_user_id VARCHAR(500) NOT NULL,
 title VARCHAR(500) NOT NULL,
 description VARCHAR(500),
 visibility VARCHAR(500) NOT NULL DEFAULT 'collaborators',
    CHECK (visibility IN ('public', 'friends', 'collaborators')),
 is_completed BOOLEAN NOT NULL DEFAULT FALSE,
 cover_image_id INT
);

ALTER TABLE board
    ADD CONSTRAINT PK_board PRIMARY KEY (board_id);


CREATE TABLE board_member (
 board_id INT NOT NULL,
 user_id VARCHAR(500) NOT NULL,
 role VARCHAR(10) NOT NULL
    CHECK (role IN ('editor', 'viewer'))
);

ALTER TABLE board_member ADD CONSTRAINT PK_board_member PRIMARY KEY (board_id,user_id);


CREATE TABLE board_tag (
 board_id INT NOT NULL,
 tag_id INT NOT NULL
);

ALTER TABLE board_tag ADD CONSTRAINT PK_board_tag PRIMARY KEY (board_id,tag_id);


CREATE TABLE saved_boards (
 board_id INT NOT NULL,
 user_id VARCHAR(500) NOT NULL
);

ALTER TABLE saved_boards ADD CONSTRAINT PK_saved_boards PRIMARY KEY (board_id,user_id);


CREATE TABLE activity (
 activity_id INT GENERATED ALWAYS AS IDENTITY NOT NULL,
 day_number INT NOT NULL CHECK (day_number >= 1),
 activity_time TIME,
 board_id INT NOT NULL,
 position INT NOT NULL,
 title VARCHAR(500) NOT NULL,
 note VARCHAR(500),
 location_id INT,
 type VARCHAR(500) NOT NULL,
 cover_image_id INT,
 api_image_id VARCHAR(500)
);

ALTER TABLE activity ADD CONSTRAINT PK_activity PRIMARY KEY (activity_id);


CREATE TABLE activity_image (
 uploaded_image_id INT NOT NULL,
 activity_id INT NOT NULL,
 position INT NOT NULL
);

ALTER TABLE activity_image ADD CONSTRAINT PK_activity_image PRIMARY KEY (uploaded_image_id);


CREATE TABLE saved_activities (
 user_id VARCHAR(500) NOT NULL,
 activity_id INT NOT NULL
);

ALTER TABLE saved_activities ADD CONSTRAINT PK_saved_activities PRIMARY KEY (user_id,activity_id);


ALTER TABLE app_user
  ADD CONSTRAINT uq_app_user_username UNIQUE (username);

ALTER TABLE app_user
  ADD CONSTRAINT FK_app_user_0
  FOREIGN KEY (profile_picture_image_id)
  REFERENCES uploaded_image (uploaded_image_id)
  ON DELETE SET NULL;

ALTER TABLE friendship ADD CONSTRAINT FK_friendship_0 FOREIGN KEY (requester_user_id) REFERENCES app_user (user_id);
ALTER TABLE friendship ADD CONSTRAINT FK_friendship_1 FOREIGN KEY (recipient_user_id) REFERENCES app_user (user_id);


ALTER TABLE uploaded_image ADD CONSTRAINT FK_uploaded_image_0 FOREIGN KEY (uploaded_by_user_id) REFERENCES app_user (user_id);


ALTER TABLE user_language ADD CONSTRAINT FK_user_language_0 FOREIGN KEY (user_id) REFERENCES app_user (user_id);
ALTER TABLE user_language ADD CONSTRAINT FK_user_language_1 FOREIGN KEY (language_name) REFERENCES language (language_name);


ALTER TABLE user_tag ADD CONSTRAINT FK_user_tag_0 FOREIGN KEY (user_id) REFERENCES app_user (user_id);
ALTER TABLE user_tag ADD CONSTRAINT FK_user_tag_1 FOREIGN KEY (tag_id) REFERENCES tag (tag_id);


ALTER TABLE board ADD CONSTRAINT FK_board_0 FOREIGN KEY (owner_user_id) REFERENCES app_user (user_id);
ALTER TABLE board ADD CONSTRAINT FK_board_1 FOREIGN KEY (cover_image_id) REFERENCES uploaded_image (uploaded_image_id) ON DELETE SET NULL;


ALTER TABLE board_member ADD CONSTRAINT FK_board_member_0 FOREIGN KEY (board_id) REFERENCES board (board_id) ON DELETE CASCADE;
ALTER TABLE board_member ADD CONSTRAINT FK_board_member_1 FOREIGN KEY (user_id) REFERENCES app_user (user_id);


ALTER TABLE board_tag ADD CONSTRAINT FK_board_tag_0 FOREIGN KEY (board_id) REFERENCES board (board_id) ON DELETE CASCADE;
ALTER TABLE board_tag ADD CONSTRAINT FK_board_tag_1 FOREIGN KEY (tag_id) REFERENCES tag (tag_id);


ALTER TABLE saved_boards ADD CONSTRAINT FK_saved_boards_0 FOREIGN KEY (board_id) REFERENCES board (board_id) ON DELETE CASCADE;
ALTER TABLE saved_boards ADD CONSTRAINT FK_saved_boards_1 FOREIGN KEY (user_id) REFERENCES app_user (user_id);


ALTER TABLE activity ADD CONSTRAINT FK_activity_0 FOREIGN KEY (board_id) REFERENCES board (board_id) ON DELETE CASCADE;
ALTER TABLE activity ADD CONSTRAINT FK_activity_1 FOREIGN KEY (location_id) REFERENCES Location (location_id);
ALTER TABLE activity ADD CONSTRAINT FK_activity_2 FOREIGN KEY (type) REFERENCES activity_type (type);
ALTER TABLE activity ADD CONSTRAINT FK_activity_3 FOREIGN KEY (cover_image_id) REFERENCES uploaded_image (uploaded_image_id) ON DELETE SET NULL;


ALTER TABLE activity_image ADD CONSTRAINT FK_activity_image_0 FOREIGN KEY (uploaded_image_id) REFERENCES uploaded_image (uploaded_image_id) ON DELETE CASCADE;
ALTER TABLE activity_image ADD CONSTRAINT FK_activity_image_1 FOREIGN KEY (activity_id) REFERENCES activity (activity_id) ON DELETE CASCADE;


ALTER TABLE saved_activities ADD CONSTRAINT FK_saved_activities_0 FOREIGN KEY (user_id) REFERENCES app_user (user_id);
ALTER TABLE saved_activities ADD CONSTRAINT FK_saved_activities_1 FOREIGN KEY (activity_id) REFERENCES activity (activity_id) ON DELETE CASCADE;
