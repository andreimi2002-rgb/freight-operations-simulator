param(
  [Parameter(Mandatory = $true)]
  [string]$ArchivePath,
  [string]$OutputPath = "src/data/geonames-cities.json"
)

$ErrorActionPreference = "Stop"
$atsCountries = @("US")
$etsCountries = @(
  "AT", "BE", "BG", "CH", "CZ", "DE", "DK", "EE", "ES", "FI", "FR",
  "GB", "GR", "HR", "HU", "IE", "IT", "LT", "LU", "LV", "ME", "MK",
  "NL", "NO", "PL", "PT", "RO", "RS", "SE", "SI", "SK", "TR"
)

$archiveFullPath = (Resolve-Path -LiteralPath $ArchivePath).Path
$outputFullPath = Join-Path (Get-Location).Path $OutputPath
$zip = [System.IO.Compression.ZipFile]::OpenRead($archiveFullPath)
try {
  $entry = $zip.Entries | Where-Object { $_.Name -eq "cities15000.txt" } | Select-Object -First 1
  if (-not $entry) { throw "cities15000.txt was not found in the GeoNames archive." }

  $reader = [System.IO.StreamReader]::new($entry.Open(), [System.Text.Encoding]::UTF8)
  try {
    $cities = [System.Collections.Generic.List[object]]::new()
    while ($null -ne ($line = $reader.ReadLine())) {
      $columns = $line.Split("`t")
      if ($columns.Count -lt 18 -or $columns[6] -ne "P") { continue }

      $country = $columns[8]
      $worlds = [System.Collections.Generic.List[string]]::new()
      if ($country -in $atsCountries) {
        $lat = [double]::Parse($columns[4], [System.Globalization.CultureInfo]::InvariantCulture)
        $lon = [double]::Parse($columns[5], [System.Globalization.CultureInfo]::InvariantCulture)
        # ATS has a connected lower-48 road map; omit Alaska, Hawaii, and territories.
        if ($lat -ge 24 -and $lat -le 50 -and $lon -ge -126 -and $lon -le -66) { $worlds.Add("ATS") }
      }
      if ($country -in $etsCountries) { $worlds.Add("ETS2") }
      if ($worlds.Count -eq 0) { continue }

      $cities.Add([ordered]@{
        id = [long]$columns[0]
        name = $columns[1]
        latitude = [double]::Parse($columns[4], [System.Globalization.CultureInfo]::InvariantCulture)
        longitude = [double]::Parse($columns[5], [System.Globalization.CultureInfo]::InvariantCulture)
        countryCode = $country
        adminCode = $columns[10]
        population = [long]$columns[14]
        timeZone = $columns[17]
        worlds = @($worlds)
      })
    }

    $topCities = [System.Collections.Generic.List[object]]::new()
    foreach ($group in ($cities | Group-Object { $_["countryCode"] })) {
      $rank = 0
      foreach ($city in ($group.Group | Sort-Object { [long]$_["population"] } -Descending | Select-Object -First 40)) {
        $rank += 1
        $city["countryRank"] = $rank
        $topCities.Add($city)
      }
    }
    $cities = $topCities
  } finally {
    $reader.Dispose()
  }
} finally {
  $zip.Dispose()
}

$payload = [ordered]@{
  metadata = [ordered]@{
    provider = "GeoNames"
    source = "https://download.geonames.org/export/dump/cities15000.zip"
    license = "CC BY 4.0"
    attribution = "GeoNames geographical database"
    importedAt = [DateTime]::UtcNow.ToString("o")
    selection = "Top 40 populated places per country in cities15000; contiguous United States for ATS and selected European countries for ETS2."
    count = $cities.Count
  }
  cities = @($cities)
}

$json = ConvertTo-Json -InputObject $payload -Depth 8 -Compress
[System.IO.Directory]::CreateDirectory([System.IO.Path]::GetDirectoryName($outputFullPath)) | Out-Null
[System.IO.File]::WriteAllText($outputFullPath, $json, [System.Text.UTF8Encoding]::new($false))
Write-Output "Wrote $($cities.Count) GeoNames cities to $outputFullPath"
