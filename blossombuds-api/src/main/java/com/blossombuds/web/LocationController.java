package com.blossombuds.web;

import com.blossombuds.domain.Country;
import com.blossombuds.domain.District;
import com.blossombuds.domain.State;
import com.blossombuds.repository.CountryRepository;
import com.blossombuds.repository.DistrictRepository;
import com.blossombuds.repository.StateRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/locations")
@RequiredArgsConstructor
public class LocationController {
    private final CountryRepository countryRepository;
    private final StateRepository stateRepository;
    private final DistrictRepository districtRepository;

    @GetMapping("/countries")
    public List<Country> getCountries() {
        return countryRepository.findAll();
    }

    @GetMapping("/states/{countryId}")
    public List<State> getStates(@PathVariable Long countryId) {
        return stateRepository.findByCountryId(countryId);
    }

    @GetMapping("/districts/{stateId}")
    public List<District> getDistricts(@PathVariable Long stateId) {
        return districtRepository.findByStateId(stateId);
    }
    @GetMapping("/states")
    public List<State> getAllStates() {
        return stateRepository.findAll();
    }

    @GetMapping("/districts")
    public List<District> getAllDistricts() {
        return districtRepository.findAll();
    }
}
