# CarPlay, Android Auto & live battery

*What is possible, what Apple and Google allow, what is built, and the steps to launch. The first half is plain language; the second half is for the developers.*

---

## 1. The short version

| Wish | iPhone + CarPlay | Android + Android Auto |
|---|---|---|
| EVWorld on the car's screen | ✅ As an **EV-charging app** (Apple approval needed) | ✅ As a **charging app** (Google review needed) |
| What it shows | Charger map/list for your car, trip status (battery, next stop, arrival %), "Navigate" button | Same |
| Turn-by-turn navigation | Hands off to Apple Maps / Google Maps / Waze on the car screen | Same |
| **Read battery % from the car** | ❌ **Apple does not give apps car data through CarPlay** | ✅ From cars that share their energy level with Android Auto |
| Read AC on/off from the car | ❌ | ❌ via Android Auto; ✅ on Android Automotive (Google built-in) cars |
| Battery % on any phone, any car | ✅ through a **connected-car account** (Enode / Smartcar) or a **Bluetooth OBD-II dongle** | ✅ same |

**So the plan is:**
1. Car screens on both CarPlay and Android Auto.
2. Battery % from Android Auto where the car shares it.
3. Battery % from **connected-car accounts** for every phone. In January 2026 Enode announced general availability of **BYD and MG**, two of the most common brands in Egypt.
4. A Bluetooth OBD dongle for cars without a cloud API (many grey imports).
5. Between readings, the app estimates the battery from distance driven, and it learns each car's real consumption.

## 2. What's built in this prototype

| Piece | Where | Status |
|---|---|---|
| Live battery while driving: estimates from distance, snaps to real readings, learns real consumption | `src/core/liveBattery.ts` (tested) | ✅ Working |
| Trip mode: live battery, next stop, automatic re-plan when the battery drifts 3%+, every 25 km or 15 min | `src/store/useDriveStore.ts`, `src/app/drive.tsx` | ✅ Working (GPS on phones; simulator in the demo) |
| Learned consumption carried to future trips (personal factor per car) | `updateConsumptionFactor`, `consumptionFactor` input of the planner | ✅ Working |
| Automatic conditions: weather temperature, AC (from car or from heat), road type, detected driving style | `src/core/autoConditions.ts`, `src/services/weather.ts` | ✅ Working |
| Car screens as data (charger list ≤ 12 points for CarPlay, ≤ 6 rows for Android Auto; trip panel) | `src/core/carScreens.ts` (tested) | ✅ Working |
| Car screen preview inside the app | `src/app/car-display.tsx` | ✅ Working |
| Car connection choices (Android Auto, car account, OBD, demo car, manual) | `src/services/vehicleData.ts`, `src/app/car-connection.tsx` | ✅ Demo car works; others need the steps below |
| Native CarPlay / Android Auto module | — | ⏳ Next step (needs a development build, can't be tested in the web demo) |

## 3. Steps to launch

1. **Apple:** request the **CarPlay EV Charging entitlement** (`com.apple.developer.carplay-charging`) from Apple. The app must be a genuine EV-charging app (it is). Approval can take weeks, so apply early.
2. **Google:** declare the Android Auto app category `androidx.car.app.category.CHARGING`. Google reviews car apps for driver distraction before they appear in cars.
3. **Build:** add a native car module and switch from Expo Go to a **development build** (EAS Build), because car screens use native code.
4. **Car data:** sign with a car-data provider (Enode or Smartcar). The app sends the driver to the provider's login, and the EVWorld server receives battery updates and pushes them to the phone.
5. **Test in real cars:** Android Auto's Desktop Head Unit and the CarPlay Simulator, then BYD / MG / Tesla / Hyundai test drives.

---

## 4. Developer notes

### 4.1 Android Auto: reading the battery (Car App Library)

Dependencies: `androidx.car.app:app` and `androidx.car.app:app-projected`. Car hardware APIs need Car App API level 3+. The energy data needs the permission `com.google.android.gms.permission.CAR_FUEL`.

```kotlin
// Inside the CarAppService Session (Kotlin)
val carInfo = carContext.getCarService(CarHardwareManager::class.java).carInfo
carInfo.addEnergyLevelListener(carContext.mainExecutor) { energy ->
    val battery = energy.batteryPercent
    if (battery.status == CarValue.STATUS_SUCCESS) {
        // Forward to JS: NativeEventEmitter "energyLevel" { batteryPercent }
        EVWorldCarDataModule.emitEnergy(battery.value, energy.rangeRemainingMeters.value)
    }
}
```

On the JavaScript side, `subscribeAndroidAuto()` in `src/services/vehicleData.ts` already listens for an `energyLevel` event from a native module named `EVWorldCarData` and feeds trip mode. Not every car shares its energy level, so `STATUS_UNAVAILABLE` must fall back to estimates.

Manifest essentials:

```xml
<uses-permission android:name="com.google.android.gms.permission.CAR_FUEL" />
<service android:name=".car.EVWorldCarAppService" android:exported="true">
  <intent-filter>
    <action android:name="androidx.car.app.CarAppService" />
    <category android:name="androidx.car.app.category.CHARGING" />
  </intent-filter>
</service>
<meta-data android:name="androidx.car.app.minCarApiLevel" android:value="3" />
```

In this Expo project, these go in through a **config plugin**, never by editing `android/` by hand.

### 4.2 CarPlay

- Entitlement: `com.apple.developer.carplay-charging`.
- Allowed templates for charging apps include `CPPointOfInterestTemplate` (map with up to 12 points) and `CPInformationTemplate`. `CPSearchTemplate` is **not** allowed for charging apps. The template hierarchy is limited in depth.
- No vehicle data API: battery comes from the car-account or OBD link.
- Draw the objects from `chargerPoiScreen()` and `tripInfoScreen()` with these templates. "Navigate" opens a maps app with the charger as the destination.

### 4.3 React Native libraries

- `react-native-carplay` (birkir) covers CarPlay and has Android Auto support. Its README has noted limitations with Expo. A community fork (`@g4rb4g3/react-native-carplay`) advertises Expo compatibility.
- Evaluate both against the current Expo SDK in a spike. If neither fits cleanly, write two small native modules (Swift for CarPlay scenes, Kotlin for the Car App service) with the Expo Modules API. The screens are simple templates, so this is a contained piece of work.

### 4.4 Car-data providers

- **Enode** and **Smartcar** offer OAuth-style "connect your car" flows and EV endpoints (battery level, charging state, range).
- Enode announced general availability of BYD and MG in January 2026. Smartcar supports MG (Europe) and other brands. Check each brand's coverage for **Egyptian-market cars** in a pilot, because cars bought from Egyptian agents or as grey imports may be registered to different regional clouds.
- Run the provider integration on the EVWorld server (webhooks for battery updates). Never put provider secrets in the app.

### Sources

- Android: [Car hardware APIs](https://developer.android.com/training/cars/apps/library/car-hardware-api), [CarInfo reference](https://developer.android.com/reference/androidx/car/app/hardware/info/CarInfo)
- Apple: [CarPlay framework](https://developer.apple.com/documentation/carplay), [Developer forum: charging entitlement and CPSearchTemplate](https://developer.apple.com/forums/thread/772003), [CarPlay Developer Guide](https://developer.apple.com/download/files/CarPlay-Developer-Guide.pdf)
- Car data: [Enode: BYD & MG generally available (Jan 2026)](https://developers.enode.com/api/changelog/updates/2026-01-30-byd-mg-vehicles-and-tesla-chargers-are-now-generally-available), [Smartcar MG](https://smartcar.com/brand/mg)
- Libraries: [react-native-carplay](https://www.github.com/birkir/react-native-carplay), [@g4rb4g3/react-native-carplay](https://cdn.jsdelivr.net/npm/@g4rb4g3/react-native-carplay@2.7.22/README.md)
