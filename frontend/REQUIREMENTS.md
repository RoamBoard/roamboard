# Roamboard frontend requirements

These are the supplied frontend requirements. They take precedence over the project proposal where the two differ. They describe intended behavior, not the current implementation.

Conditional wording is preserved: features described as optional, feasible, or useful remain conditional. The optional extensions below are not required features.

## Purpose

Roamboard helps users turn their trips into Boards that they can keep, share, and use to inspire future travel.
A Board can either be:

- A planned itinerary created before or during a trip.
- A travel journal created during or after a trip using text, locations, and images.

Users should be able to easily create, manage, review, edit, and share their Boards.

## Boards and their content

Users should be able to:

- Create a new Board.
- Edit an existing Board.
- Delete a Board.
- Mark a Board as completed.
- Add tags to a Board.
- Choose a cover image for a Board.
- Upload their own images to a Board.
- Change the order of activities and other Board content using drag and drop.
- Copy an existing Board to create their own editable version.
- Copy individual locations or activities from another Board into their own Board.

A Board should support:

- Activities.
- Locations connected to activities.
- Dates and times for planned activities where relevant.
- Text and descriptions.
- Images provided by the application.
- Photos uploaded by the user.
- A map showing the locations of activities.
- Walking routes between locations.

If implemented, users should be able to format longer text using a simple text editor, including:

- Bold.
- Italic.
- Underline.
- Headings.
- Lists.

This can be used for travel journals, activity descriptions, recommendations, and notes.

## Search and discovery

Users should be able to search for public Boards.
Search should support:

- City.
- Country.
- Keywords and semantic searches, such as "best food weekend in Tokyo".

Users should not see duplicate results when the same destination, place, or Board is returned from multiple search sources.
Users should be able to filter results based on:

- Trip length, such as day trip, weekend, or longer trip.
- Interests, such as food, museums, nightlife, shopping, or outdoor activities.
- Budget.
- Travel style, such as solo, couple, friends, or family travel.

The home/discover page should suggest:

- Destinations to explore.
- Popular Boards.
- Trending destinations.
- Boards relevant to the user's interests.

Where useful, trends or travel statistics can be displayed visually using charts.
Users should be able to:

- Save another user's Board for later.
- Copy another user's Board and create their own editable version.
- Copy individual locations or activities from another Board into one of their Boards.

## Sharing and visibility

Users should be able to share a Board using a link.
Each Board should have one of three visibility settings:


- The Board can be viewed by the owner's friends on Roamboard.
- Anyone can view the Board.

The interface should clearly communicate who can currently access a Board.

## Friends and social profiles

Users should be able to:

- Send or accept friend requests.
- Add friends.
- Remove friends.
- View another user's profile when permitted.

A user profile should contain:

- Name.
- Profile picture.
- Interests/tags.
- Boards that the user has chosen to make visible.

The Friends page should show:

- The user's friend list.
- Boards shared by their friends.
- Recommended users that they may want to add.

## Accounts and personal profiles

Users should be able to:

- Create an account.
- Log in.
- Log out.
- Stay logged in between visits.
- Edit their profile.
- Upload and change their profile picture.
- Add interests or tags to their profile.

If feasible, users should also be able to sign in using Google or a similar authentication provider.
Users should be able to see a map showing places they have visited based on completed Boards.
The profile can also display travel statistics such as:

- Number of countries visited.
- Number of cities visited.
- Number of completed trips.
- Most visited country or city.
- Types of activities they frequently add to Boards.

## Validation and errors

The app should prevent users from submitting clearly invalid information.
For example:

- Names should not contain unsupported characters.
- Email addresses should follow a valid email format.
- Usernames should only contain permitted characters.
- Required fields should not be empty.
- Invalid links or incorrectly formatted information should be rejected.

When input is invalid, the user should receive a clear explanation of what needs to be corrected.
When an action fails, the app should display a meaningful message, such as:

- "This Board could not be found."
- "You need to log in to perform this action."
- "You don't have permission to edit this Board."
- "The image could not be uploaded."

## Responsive layout, themes, and animation

The application should work well on both desktop and smaller screens.
Users should be able to use the application in:

- Light mode.
- Dark mode.

Common actions and interface elements should behave consistently throughout the application.
The interface can use animations and transitions where they help communicate actions, for example:

- Opening a Board.
- Adding or removing an activity.
- Reordering activities.
- Saving a Board.
- Opening menus or dialogs.
- Switching between pages.

Animations should support usability rather than interfere with it.

## Loading and progress

Users should receive clear feedback when the application is performing an action that takes time.
This includes:

- Uploading images.
- Loading search results.
- Loading destination information.
- Saving changes.
- Copying a Board.
- Loading recommendations.

For longer-running operations, the application should display an appropriate loading or progress state rather than appearing unresponsive.

## Optional extensions

Users could join communities built around destinations, interests, or types of travel.
A more advanced travel-journal editor could support richer formatting and media layouts.
Users could enter preferences such as destination, duration, budget, and interests and receive a suggested itinerary that they can edit and save as a Board.
