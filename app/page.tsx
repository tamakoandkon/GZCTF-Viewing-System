import { redirect } from "next/navigation"

export default function Home() {
  // Redirect to a default game ID
  // In a real app, you might want to fetch available games or show a selection screen
  redirect("/scoreboard/3")
}
