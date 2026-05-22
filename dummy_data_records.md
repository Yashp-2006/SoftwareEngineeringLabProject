# Dummy Data Record

The following dummy user profiles have been injected into the Firestore `users` collection for testing the UI and roles.

**To remove them later:**
1. Open the Firebase Console.
2. Navigate to Firestore Database -> `users` collection.
3. Delete the documents with the following Document IDs (`uid`):

| UID | Email | Role |
| :--- | :--- | :--- |
| `dummy-1` | `mat1_operator@taikaix.com` | `mat_operator` |
| `dummy-2` | `gate_volunteer@taikaix.com` | `attendance_volunteer` |
| `dummy-3` | `medals_desk@taikaix.com` | `medal_distributor` |
| `dummy-4` | `random_fan@example.com` | `audience` |

> [!NOTE]
> These dummy users cannot log into the application because there are no matching Firebase Authentication accounts for them. They exist purely in Firestore to populate the Access Management table.
