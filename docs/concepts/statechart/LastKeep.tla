---- MODULE LastKeep ----
\* Last Keep, as a player sees one room.
\* The constants are the code's, except the keep cap. Rules.town_rank_cap/0
\* is 4. This model uses 1 so the chart stays readable. One raise stands for
\* each raise, and the next press does not climb past the cap.
\*
\* A body on the join ring is outside the raise. add_player stands at radius
\* 120 and respawn stands at 110. Rules.raise_reach/0 is 100, and try_raise
\* refuses when the distance is 100 or more.
\*
\* The phone stick and the keys are the same walk. The phone Raise and the
\* bar Raise are the same press. A press from the ring is refused.
\*
\* The door is the dusk yard. Left and right change the class, and Create
\* and Join are that same screen. A stored seat sits without showing it.
\* The model still calls that sit.

EXTENDS Naturals

RankCap == 1

VARIABLES screen, place, friend, hostIn, rank, purse

vars == <<screen, place, friend, hostIn, rank, purse>>

Screens == {"door", "lobby", "day", "night", "frenzy", "fallen", "closed"}
Places == {"out", "ring", "keep", "down", "told"}
Friends == {"none", "here", "left"}
Playing == {"lobby", "day", "night", "frenzy"}
Live == Playing \cup {"fallen"}

SomeoneIn == hostIn \/ friend = "here"

TypeOK ==
    /\ screen \in Screens
    /\ place \in Places
    /\ friend \in Friends
    /\ hostIn \in BOOLEAN
    /\ rank \in 0..RankCap
    /\ purse \in BOOLEAN

\* There is no victory screen. The run ends when the keep falls, or the room closes.
NoVictoryScreen == screen # "victory"

\* The keep stops at the cap.
RankStops == rank <= RankCap

\* A hero is down only after a fight, or still down when the day returns or the keep falls.
DownOnlyAfterAFight == place = "down" => screen \in {"day", "night", "frenzy", "fallen"}

\* The door and a closed room have no body and no open seat.
OutsideIsEmpty ==
    screen \in {"door", "closed"} =>
        /\ place = "out"
        /\ hostIn = FALSE
        /\ friend = "none"

Init ==
    /\ screen = "door"
    /\ place = "out"
    /\ friend = "none"
    /\ hostIn = FALSE
    /\ rank = 0
    /\ purse = FALSE

YouSitDown ==
    /\ screen = "door"
    /\ screen' = "lobby"
    /\ place' = "ring"
    /\ hostIn' = TRUE
    /\ UNCHANGED <<friend, rank, purse>>

TheHostStarts ==
    /\ screen = "lobby"
    /\ hostIn
    /\ screen' = "day"
    /\ UNCHANGED <<place, friend, hostIn, rank, purse>>

\* The server ignores Start from anyone but p1. Sim.release/2.
AFriendPressesStart ==
    /\ screen = "lobby"
    /\ friend = "here"
    /\ UNCHANGED vars

YouWalkToTheKeep ==
    /\ screen \in Playing
    /\ hostIn
    /\ place \in {"ring", "told"}
    /\ place' = "keep"
    /\ UNCHANGED <<screen, friend, hostIn, rank, purse>>

YouWalkOffTheKeep ==
    /\ screen \in Playing
    /\ hostIn
    /\ place = "keep"
    /\ place' = "ring"
    /\ UNCHANGED <<screen, friend, hostIn, rank, purse>>

ThePurseFills ==
    /\ screen \in Playing
    /\ SomeoneIn
    /\ ~purse
    /\ purse' = TRUE
    /\ UNCHANGED <<screen, place, friend, hostIn, rank>>

YouRaiseTheKeep ==
    /\ screen \in Playing
    /\ hostIn
    /\ place = "keep"
    /\ rank < RankCap
    /\ purse
    /\ rank' = rank + 1
    /\ purse' = FALSE
    /\ UNCHANGED <<screen, place, friend, hostIn>>

\* Bar and phone, from outside radius 100. The server sends "Walk to the keep".
YouTryToRaiseFromTheRing ==
    /\ screen \in Playing
    /\ hostIn
    /\ place = "ring"
    /\ rank < RankCap
    /\ place' = "told"
    /\ UNCHANGED <<screen, friend, hostIn, rank, purse>>

AMonsterDownsYou ==
    /\ screen \in {"night", "frenzy"}
    /\ SomeoneIn
    /\ place \in {"ring", "keep", "told"}
    /\ place' = "down"
    /\ UNCHANGED <<screen, friend, hostIn, rank, purse>>

YouStandBackUp ==
    /\ screen \in Playing
    /\ SomeoneIn
    /\ place = "down"
    /\ place' = "ring"
    /\ UNCHANGED <<screen, friend, hostIn, rank, purse>>

TheHornSounds ==
    /\ screen = "day"
    /\ SomeoneIn
    /\ screen' = "night"
    /\ UNCHANGED <<place, friend, hostIn, rank, purse>>

TheNightRunsLong ==
    /\ screen = "night"
    /\ SomeoneIn
    /\ screen' = "frenzy"
    /\ UNCHANGED <<place, friend, hostIn, rank, purse>>

TheNightClears ==
    /\ screen \in {"night", "frenzy"}
    /\ SomeoneIn
    /\ screen' = "day"
    /\ purse' = IF rank < RankCap THEN TRUE ELSE purse
    /\ UNCHANGED <<place, friend, hostIn, rank>>

TheKeepFalls ==
    /\ screen \in {"night", "frenzy"}
    /\ SomeoneIn
    /\ screen' = "fallen"
    /\ UNCHANGED <<place, friend, hostIn, rank, purse>>

Fresh ==
    /\ screen' = "lobby"
    /\ place' = "ring"
    /\ rank' = 0
    /\ purse' = FALSE
    /\ UNCHANGED <<friend, hostIn>>

YouPressNewKeep ==
    /\ screen = "fallen"
    /\ SomeoneIn
    /\ Fresh

\* GameChannel accepts "restart" with no phase check. The button is only on the fallen screen.
TheSocketRestarts ==
    /\ screen \in Playing
    /\ SomeoneIn
    /\ Fresh

AFriendSitsDown ==
    /\ screen \in Playing
    /\ friend = "none"
    /\ friend' = "here"
    /\ UNCHANGED <<screen, place, hostIn, rank, purse>>

AFriendLeaves ==
    /\ screen \in Live
    /\ friend = "here"
    /\ friend' = "left"
    /\ UNCHANGED <<screen, place, hostIn, rank, purse>>

AFriendComesBack ==
    /\ screen \in Live
    /\ friend = "left"
    /\ friend' = "here"
    /\ UNCHANGED <<screen, place, hostIn, rank, purse>>

YouLeave ==
    /\ screen \in Live
    /\ hostIn
    /\ hostIn' = FALSE
    /\ UNCHANGED <<screen, place, friend, rank, purse>>

YouComeBack ==
    /\ screen \in Live
    /\ ~hostIn
    /\ hostIn' = TRUE
    /\ UNCHANGED <<screen, place, friend, rank, purse>>

TheRoomCloses ==
    /\ screen \in Live
    /\ ~SomeoneIn
    /\ screen' = "closed"
    /\ place' = "out"
    /\ friend' = "none"
    /\ hostIn' = FALSE
    /\ UNCHANGED <<rank, purse>>

Done ==
    /\ screen = "closed"
    /\ UNCHANGED vars

Next ==
    \/ YouSitDown
    \/ TheHostStarts
    \/ AFriendPressesStart
    \/ YouWalkToTheKeep
    \/ YouWalkOffTheKeep
    \/ ThePurseFills
    \/ YouRaiseTheKeep
    \/ YouTryToRaiseFromTheRing
    \/ AMonsterDownsYou
    \/ YouStandBackUp
    \/ TheHornSounds
    \/ TheNightRunsLong
    \/ TheNightClears
    \/ TheKeepFalls
    \/ YouPressNewKeep
    \/ TheSocketRestarts
    \/ AFriendSitsDown
    \/ AFriendLeaves
    \/ AFriendComesBack
    \/ YouLeave
    \/ YouComeBack
    \/ TheRoomCloses
    \/ Done

Spec == Init /\ [][Next]_vars

\* A new friend cannot take a seat after the keep has fallen. Sim.join/2.
NoNewSeatOnFallen ==
    [][screen = "fallen" /\ friend = "none" => friend' = "none"]_vars

\* The fallen phase does not respawn. respawns/1 and the :over tick.
NoRespawnOnFallen ==
    [][screen = "fallen" /\ place = "down" => place' = "down" \/ screen' # "fallen"]_vars

\* Only the host starts the night. The button is disabled for everyone else.
OnlyTheHostStarts ==
    [][screen = "lobby" /\ screen' = "day" => hostIn]_vars

\* A raise spends the purse only at the keep, and only while that hero is connected.
RaiseOnlyAtTheKeep ==
    [][rank' > rank => place = "keep" /\ hostIn /\ screen \in Playing]_vars

\* Standing back up puts you on the ring, outside the raise, not on the keep.
RespawnLandsOffTheKeep ==
    [][place = "down" /\ place' \in {"ring", "keep", "told"} => place' = "ring"]_vars

\* The keep falls from the night, not from the day. Staying fallen is not a fall.
FallOnlyFromTheNight ==
    [][screen # "fallen" /\ screen' = "fallen" => screen \in {"night", "frenzy"}]_vars

\* The page offers New keep only after the fall. Rewinding a live or waiting
\* room to a fresh lobby is the socket restart the button does not show.
NoRestartBeforeTheFall ==
    [][
        /\ screen' = "lobby"
        /\ place' = "ring"
        /\ rank' = 0
        /\ purse' = FALSE
        /\ \/ screen # "lobby"
           \/ place # "ring"
           \/ rank # 0
           \/ purse # FALSE
        => screen \in {"door", "fallen"}
    ]_vars

====
